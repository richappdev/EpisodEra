package com.episodera.feature.detail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.*
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

data class DetailUiState(val loading: Boolean = true, val error: String? = null, val detail: MediaDetail? = null, val liked: Boolean = false, val likeId: String? = null, val watchlistId: String? = null, val season: TvSeasonDetail? = null, val watchedKeys: Set<String> = emptySet(), val discussions: List<DiscussionComment> = emptyList())
@HiltViewModel class DetailViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    var state by mutableStateOf(DetailUiState()); private set
    private var type = MediaType.MOVIE
    private var mediaId = 0
    fun load(typeValue: String, id: Int, signedIn: Boolean) = viewModelScope.launch {
        type = if (typeValue == MediaType.TV.wireValue) MediaType.TV else MediaType.MOVIE
        mediaId = id; state = DetailUiState()
        val detail = runCatching { repository.detail(type, id) }
        if (detail.isFailure) {
            state = DetailUiState(false, detail.exceptionOrNull()?.message ?: "Unable to load this title")
            return@launch
        }
        val likes = if (signedIn) runCatching { repository.allLikes() }.getOrDefault(emptyList()) else emptyList()
        val watchlist = if (signedIn) runCatching { repository.allWatchlist() }.getOrDefault(emptyList()) else emptyList()
        val discussions = runCatching { repository.discussions(type, id).items }.getOrDefault(emptyList())
        state = DetailUiState(false, detail = detail.getOrNull(), liked = likes.any { it.tmdbId == id && it.mediaType == type },
            likeId = likes.firstOrNull { it.tmdbId == id && it.mediaType == type }?.itemId,
            watchlistId = watchlist.firstOrNull { it.tmdbId == id && it.mediaType == type }?.itemId, discussions = discussions)
    }
    fun toggleLike() = viewModelScope.launch {
        val detail = state.detail ?: return@launch
        val likeId = state.likeId
        runCatching {
            if (state.liked) repository.removeLike(likeId ?: return@runCatching)
            else repository.addLike(AddLikedItemInput(detail.id, detail.mediaType, detail.title, detail.images.poster, detail.images.backdrop))
        }.onSuccess { load(type.wireValue, mediaId, true) }.onFailure { state = state.copy(error = it.message) }
    }
    fun toggleWatchlist() = viewModelScope.launch {
        val detail = state.detail ?: return@launch
        val watchlistId = state.watchlistId
        runCatching {
            if (watchlistId != null) repository.removeWatchlist(watchlistId)
            else repository.addWatchlist(AddWatchlistItemInput(detail.id, detail.mediaType, detail.title, detail.images.poster, detail.images.backdrop, WatchlistStatus.PLANNED))
        }.onSuccess { load(type.wireValue, mediaId, true) }.onFailure { state = state.copy(error = it.message) }
    }
    fun loadSeason(seasonNumber: Int, signedIn: Boolean) = viewModelScope.launch {
        runCatching {
            val season = repository.tvSeason(mediaId, seasonNumber)
            val watched = if (signedIn) repository.getProgress(mediaId).progress?.episodes?.filter { it.watched }?.map { it.episodeKey }?.toSet().orEmpty() else emptySet()
            season to watched
        }.onSuccess { (season, watched) -> state = state.copy(season = season, watchedKeys = watched) }
    }
    fun toggleEpisode(episode: EpisodeSummary) = viewModelScope.launch {
        runCatching {
            if (episode.episodeKey in state.watchedKeys) repository.unmarkEpisode(mediaId, episode.episodeKey)
            else repository.markEpisode(mediaId, MarkEpisodeWatchedInput(episode.seasonNumber, episode.episodeNumber))
        }.onSuccess { state.season?.let { loadSeason(it.seasonNumber, true) } }
    }
    fun markSeasonWatched() = viewModelScope.launch {
        val season = state.season ?: return@launch
        runCatching { repository.batchEpisodes(mediaId, BatchEpisodeProgressInput(true, season.episodes.map { MarkEpisodeWatchedInput(it.seasonNumber, it.episodeNumber) })) }
            .onSuccess { loadSeason(season.seasonNumber, true) }
    }
    fun postDiscussion(body: String) = viewModelScope.launch {
        if (body.isBlank()) return@launch
        runCatching { repository.createDiscussion(type, mediaId, body) }.onSuccess { load(type.wireValue, mediaId, true) }
            .onFailure { state = state.copy(error = it.message) }
    }
}
@Composable fun MovieDetailRoute(id: Int, signedIn: Boolean, onRequireAuth: () -> Unit, onBack: () -> Unit, viewModel: DetailViewModel = hiltViewModel()) = DetailRoute("movie", id, signedIn, null, onRequireAuth, onBack, viewModel)
@Composable fun TvDetailRoute(id: Int, signedIn: Boolean, onRequireAuth: () -> Unit, onBack: () -> Unit, initialSeason: Int? = null, viewModel: DetailViewModel = hiltViewModel()) = DetailRoute("tv", id, signedIn, initialSeason, onRequireAuth, onBack, viewModel)
@Composable fun DetailRoute(mediaType: String, id: Int, signedIn: Boolean, initialSeason: Int?, onRequireAuth: () -> Unit, onBack: () -> Unit, viewModel: DetailViewModel = hiltViewModel()) {
    LaunchedEffect(mediaType, id, signedIn, initialSeason) {
        viewModel.load(mediaType, id, signedIn).join()
        initialSeason?.let { viewModel.loadSeason(it, signedIn) }
    }
    fun authenticated(action: () -> Unit) { if (signedIn) action() else onRequireAuth() }
    DetailScreen(viewModel.state, onBack,
        { authenticated(viewModel::toggleWatchlist) },
        { authenticated(viewModel::toggleLike) },
        { season -> viewModel.loadSeason(season, signedIn) },
        { episode -> authenticated { viewModel.toggleEpisode(episode) } },
        { authenticated(viewModel::markSeasonWatched) },
        { body -> authenticated { viewModel.postDiscussion(body) } },
    )
}
@Composable fun DetailScreen(state: DetailUiState, onBack: () -> Unit, onWatchlist: () -> Unit, onLike: () -> Unit, onSeason: (Int) -> Unit, onEpisode: (EpisodeSummary) -> Unit, onMarkSeason: () -> Unit, onPostDiscussion: (String) -> Unit) {
    when { state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
        state.error != null -> Column(Modifier.padding(24.dp)) { Text(state.error); TextButton(onClick = onBack) { Text(stringResource(DR.string.go_back)) } }
        state.detail == null -> Text(stringResource(DR.string.title_unavailable), Modifier.padding(24.dp))
        else -> LazyColumn(Modifier.fillMaxSize()) {
            item { AsyncImage(state.detail.images.backdrop ?: state.detail.images.poster, state.detail.title, Modifier.fillMaxWidth().height(250.dp)) }
            item { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.detail.title, style = MaterialTheme.typography.headlineMedium)
                Text(state.detail.overview)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onWatchlist) { Text(stringResource(if (state.watchlistId != null) DR.string.remove_watchlist else DR.string.add_watchlist)) }
                    OutlinedButton(onClick = onLike) { Text(stringResource(if (state.liked) DR.string.liked_action else DR.string.like)) }
                }
                if (state.detail.mediaType == MediaType.TV) {
                    Text(stringResource(DR.string.episodes), style = MaterialTheme.typography.titleLarge)
                    state.detail.seasons.orEmpty().forEach { season ->
                        AssistChip(onClick = { onSeason(season.seasonNumber) }, label = { Text(season.title) })
                    }
                    state.season?.let { season ->
                        Button(onClick = onMarkSeason) { Text(stringResource(DR.string.mark_season_watched)) }
                        season.episodes.forEach { episode ->
                            TextButton(onClick = { onEpisode(episode) }) {
                                Text("${if (episode.episodeKey in state.watchedKeys) "✓ " else ""}S${episode.seasonNumber}E${episode.episodeNumber} ${episode.title}")
                            }
                        }
                    }
                }
                Text(stringResource(DR.string.discussion), style = MaterialTheme.typography.titleLarge)
                var discussion by remember { mutableStateOf("") }
                OutlinedTextField(discussion, { discussion = it }, label = { Text(stringResource(DR.string.comment_hint)) }, modifier = Modifier.fillMaxWidth())
                Button(onClick = { onPostDiscussion(discussion); discussion = "" }) { Text(stringResource(DR.string.post_comment)) }
                state.discussions.forEach { comment -> Text("${comment.displayName}: ${if (comment.spoilerHidden) stringResource(DR.string.spoiler_hidden) else comment.body.orEmpty()}") }
            }}
        }
    }
}
