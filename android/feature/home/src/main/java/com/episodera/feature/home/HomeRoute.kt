package com.episodera.feature.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.MediaSummary
import com.google.firebase.auth.FirebaseAuth
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

data class HomeUiState(val loading: Boolean = true, val error: String? = null, val tv: List<MediaSummary> = emptyList(), val movies: List<MediaSummary> = emptyList(), val suggestions: List<MediaSummary> = emptyList(), val continueWatching: List<MediaSummary> = emptyList())

@HiltViewModel
class HomeViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    var state by mutableStateOf(HomeUiState()); private set
    init { load() }
    fun load() = viewModelScope.launch {
        state = HomeUiState()
        runCatching {
            val trending = repository.trending()
            val suggestions = repository.discoverySuggestions().rails.flatMap { it.items }
            val continueWatching = if (FirebaseAuth.getInstance().currentUser != null) {
                val watched = repository.watchlist().items.associateBy { it.tmdbId }
                repository.progress().items.mapNotNull { progress ->
                    watched[progress.tmdbId]?.let { item ->
                        MediaSummary(item.tmdbId, item.mediaType, item.title, "", voteAverage = 0.0, popularity = 0.0, images = com.episodera.core.model.ImageSet(item.poster, item.backdrop))
                    }
                }
            } else emptyList()
            Quadruple(trending.tv.results, trending.movies.results, suggestions, continueWatching)
        }.onSuccess { (tv, movies, suggestions, continueWatching) -> state = HomeUiState(false, tv = tv, movies = movies, suggestions = suggestions, continueWatching = continueWatching) }
            .onFailure { state = HomeUiState(false, it.message ?: "Could not load your cinema") }
    }
}

@Composable
fun HomeRoute(onOpenMedia: (String, Int) -> Unit, onOpenList: (String) -> Unit, viewModel: HomeViewModel = hiltViewModel()) =
    HomeScreen(viewModel.state, viewModel::load, onOpenMedia, onOpenList)

@Composable
fun HomeScreen(state: HomeUiState, onRetry: () -> Unit, onOpenMedia: (String, Int) -> Unit, onOpenList: (String) -> Unit) {
    when {
        state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
        state.error != null -> Column(Modifier.padding(24.dp)) { Text(state.error); Button(onClick = onRetry) { Text("Retry") } }
        else -> androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item { Text("Your cinema", style = MaterialTheme.typography.headlineMedium) }
            item { MediaRail("Continue Watching", state.continueWatching, onOpenMedia) }
            item { MoodRow(onOpenList) }
            item { MediaRail("Made for tonight", state.suggestions, onOpenMedia) }
            item { MediaRail("Trending TV", state.tv, onOpenMedia) }
            item { MediaRail("Trending movies", state.movies, onOpenMedia) }
        }
    }
}

@Composable private fun MoodRow(onOpenList: (String) -> Unit) = LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    items(listOf("Comfort", "Edge of seat", "Laugh", "One more episode")) { mood -> AssistChip(onClick = { onOpenList(mood.lowercase().replace(' ', '-')) }, label = { Text(mood) }) }
}
@Composable private fun MediaRail(title: String, media: List<MediaSummary>, onOpenMedia: (String, Int) -> Unit) {
    Column { Text(title, style = MaterialTheme.typography.titleLarge); if (media.isEmpty()) Text("Nothing queued yet.") else LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(media) { item -> Column(Modifier.width(120.dp).clickable { onOpenMedia(item.mediaType.wireValue, item.id) }) { AsyncImage(item.images.poster, item.title, Modifier.height(170.dp).fillMaxWidth()); Text(item.title, maxLines = 2) } }
    }}
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
