package com.episodera.feature.detail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.*
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

data class DetailUiState(val loading: Boolean = true, val error: String? = null, val detail: MediaDetail? = null, val liked: Boolean = false, val likeId: String? = null, val watchlistId: String? = null, val season: TvSeasonDetail? = null, val watchedKeys: Set<String> = emptySet(), val discussions: List<DiscussionComment> = emptyList())
@HiltViewModel class DetailViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    var state by mutableStateOf(DetailUiState()); private set
    private var type = MediaType.MOVIE
    private var mediaId = 0
    fun load(typeValue: String, id: Int) = viewModelScope.launch {
        type = if (typeValue == MediaType.TV.wireValue) MediaType.TV else MediaType.MOVIE
        mediaId = id; state = DetailUiState()
        runCatching {
            val detail = repository.detail(type, id)
            val likes = repository.likes().items
            val watchlist = repository.watchlist().items
            val discussions = repository.discussions(type, id).items
            DetailUiState(false, detail = detail, liked = likes.any { it.tmdbId == id && it.mediaType == type },
                likeId = likes.firstOrNull { it.tmdbId == id && it.mediaType == type }?.itemId,
                watchlistId = watchlist.firstOrNull { it.tmdbId == id && it.mediaType == type }?.itemId, discussions = discussions)
        }.onSuccess { state = it }.onFailure { state = DetailUiState(false, it.message ?: "Unable to load this title") }
    }
    fun toggleLike() = viewModelScope.launch {
        val detail = state.detail ?: return@launch
        val likeId = state.likeId
        runCatching {
            if (state.liked) repository.removeLike(likeId ?: return@runCatching)
            else repository.addLike(AddLikedItemInput(detail.id, detail.mediaType, detail.title, detail.images.poster, detail.images.backdrop))
        }.onSuccess { load(type.wireValue, mediaId) }.onFailure { state = state.copy(error = it.message) }
    }
    fun toggleWatchlist() = viewModelScope.launch {
        val detail = state.detail ?: return@launch
        val watchlistId = state.watchlistId
        runCatching {
            if (watchlistId != null) repository.removeWatchlist(watchlistId)
            else repository.addWatchlist(AddWatchlistItemInput(detail.id, detail.mediaType, detail.title, detail.images.poster, detail.images.backdrop, WatchlistStatus.PLANNED))
        }.onSuccess { load(type.wireValue, mediaId) }.onFailure { state = state.copy(error = it.message) }
    }
    fun loadSeason(seasonNumber: Int) = viewModelScope.launch {
        runCatching {
            val season = repository.tvSeason(mediaId, seasonNumber)
            val watched = repository.getProgress(mediaId).progress?.episodes?.filter { it.watched }?.map { it.episodeKey }?.toSet().orEmpty()
            season to watched
        }.onSuccess { (season, watched) -> state = state.copy(season = season, watchedKeys = watched) }
    }
    fun toggleEpisode(episode: EpisodeSummary) = viewModelScope.launch {
        runCatching {
            if (episode.episodeKey in state.watchedKeys) repository.unmarkEpisode(mediaId, episode.episodeKey)
            else repository.markEpisode(mediaId, MarkEpisodeWatchedInput(episode.seasonNumber, episode.episodeNumber))
        }.onSuccess { state.season?.let { loadSeason(it.seasonNumber) } }
    }
    fun markSeasonWatched() = viewModelScope.launch {
        val season = state.season ?: return@launch
        runCatching { repository.batchEpisodes(mediaId, BatchEpisodeProgressInput(true, season.episodes.map { MarkEpisodeWatchedInput(it.seasonNumber, it.episodeNumber) })) }
            .onSuccess { loadSeason(season.seasonNumber) }
    }
    fun postDiscussion(body: String) = viewModelScope.launch {
        if (body.isBlank()) return@launch
        runCatching { repository.createDiscussion(type, mediaId, body) }.onSuccess { load(type.wireValue, mediaId) }
            .onFailure { state = state.copy(error = it.message) }
    }
}
@Composable fun MovieDetailRoute(id: Int, onBack: () -> Unit, viewModel: DetailViewModel = hiltViewModel()) = DetailRoute("movie", id, onBack, viewModel)
@Composable fun TvDetailRoute(id: Int, onBack: () -> Unit, viewModel: DetailViewModel = hiltViewModel()) = DetailRoute("tv", id, onBack, viewModel)
@Composable fun DetailRoute(mediaType: String, id: Int, onBack: () -> Unit, viewModel: DetailViewModel = hiltViewModel()) {
    LaunchedEffect(mediaType, id) { viewModel.load(mediaType, id) }
    DetailScreen(viewModel.state, onBack, viewModel::toggleWatchlist, viewModel::toggleLike, viewModel::loadSeason, viewModel::toggleEpisode, viewModel::markSeasonWatched, viewModel::postDiscussion)
}
@Composable fun DetailScreen(state: DetailUiState, onBack: () -> Unit, onWatchlist: () -> Unit, onLike: () -> Unit, onSeason: (Int) -> Unit, onEpisode: (EpisodeSummary) -> Unit, onMarkSeason: () -> Unit, onPostDiscussion: (String) -> Unit) {
    when { state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
        state.error != null -> Column(Modifier.padding(24.dp)) { Text(state.error); TextButton(onClick = onBack) { Text("Go back") } }
        state.detail == null -> Text("This title is unavailable.", Modifier.padding(24.dp))
        else -> LazyColumn(Modifier.fillMaxSize()) {
            item { AsyncImage(state.detail.images.backdrop ?: state.detail.images.poster, state.detail.title, Modifier.fillMaxWidth().height(250.dp)) }
            item { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.detail.title, style = MaterialTheme.typography.headlineMedium)
                Text(state.detail.overview)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onWatchlist) { Text(if (state.watchlistId != null) "Remove from watchlist" else "Add to watchlist") }
                    OutlinedButton(onClick = onLike) { Text(if (state.liked) "♥ Liked" else "♡ Like") }
                }
                if (state.detail.mediaType == MediaType.TV) {
                    Text("Episodes", style = MaterialTheme.typography.titleLarge)
                    state.detail.seasons.orEmpty().forEach { season ->
                        AssistChip(onClick = { onSeason(season.seasonNumber) }, label = { Text(season.title) })
                    }
                    state.season?.let { season ->
                        Button(onClick = onMarkSeason) { Text("Mark season watched") }
                        season.episodes.forEach { episode ->
                            TextButton(onClick = { onEpisode(episode) }) {
                                Text("${if (episode.episodeKey in state.watchedKeys) "✓ " else ""}S${episode.seasonNumber}E${episode.episodeNumber} ${episode.title}")
                            }
                        }
                    }
                }
                Text("Discussion", style = MaterialTheme.typography.titleLarge)
                var discussion by remember { mutableStateOf("") }
                OutlinedTextField(discussion, { discussion = it }, label = { Text("Add a spoiler-aware comment") }, modifier = Modifier.fillMaxWidth())
                Button(onClick = { onPostDiscussion(discussion); discussion = "" }) { Text("Post comment") }
                state.discussions.forEach { comment -> Text("${comment.displayName}: ${comment.body.orEmpty()}") }
            }}
        }
    }
}
