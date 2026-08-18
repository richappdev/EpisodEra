package com.episodera.feature.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
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
import com.episodera.core.network.PreferencesStore
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

data class HomeUiState(val loading: Boolean = true, val error: String? = null, val tv: List<MediaSummary> = emptyList(), val movies: List<MediaSummary> = emptyList(), val rails: List<DiscoverySuggestionRail> = emptyList(), val moods: List<MoodDefinition> = emptyList(), val providers: List<StreamingProviderOption> = emptyList(), val selectedMood: String? = null, val maxMinutes: Int? = null, val selectedProviders: Set<Int> = emptySet(), val continueWatching: List<MediaSummary> = emptyList())

@HiltViewModel
class HomeViewModel @Inject constructor(private val repository: EpisodEraRepository, private val preferences: PreferencesStore) : ViewModel() {
    var state by mutableStateOf(HomeUiState()); private set
    fun load(signedIn: Boolean) = viewModelScope.launch {
        val filters = state
        state = state.copy(loading = true, error = null)
        val trending = runCatching { repository.trending() }
        val suggestions = runCatching { repository.discoverySuggestions(filters.selectedMood, filters.maxMinutes, filters.selectedProviders.takeIf { it.isNotEmpty() }?.joinToString(","), preferences.watchRegion()) }
        val continueWatching = if (signedIn) {
            runCatching {
                val watched = repository.allWatchlist().associateBy { it.tmdbId }
                repository.allProgress().map { progress ->
                    val item = watched[progress.tmdbId]
                    MediaSummary(progress.tmdbId, item?.mediaType ?: MediaType.TV, item?.title ?: progress.title, "", voteAverage = 0.0, popularity = 0.0, images = ImageSet(item?.poster ?: progress.poster, item?.backdrop))
                }
            }.getOrDefault(emptyList())
        } else emptyList()
        state = HomeUiState(
            loading = false,
            error = if (trending.isFailure && suggestions.isFailure) trending.exceptionOrNull()?.message ?: "Could not load your cinema" else null,
            tv = trending.getOrNull()?.tv?.results.orEmpty(),
            movies = trending.getOrNull()?.movies?.results.orEmpty(),
            rails = suggestions.getOrNull()?.rails.orEmpty(),
            moods = suggestions.getOrNull()?.moods.orEmpty(),
            providers = suggestions.getOrNull()?.providers.orEmpty(),
            selectedMood = filters.selectedMood,
            maxMinutes = filters.maxMinutes,
            selectedProviders = filters.selectedProviders,
            continueWatching = continueWatching,
        )
    }
    fun selectMood(value: String?, signedIn: Boolean) { state = state.copy(selectedMood = value); load(signedIn) }
    fun selectRuntime(value: Int?, signedIn: Boolean) { state = state.copy(maxMinutes = value); load(signedIn) }
    fun toggleProvider(value: Int, signedIn: Boolean) { state = state.copy(selectedProviders = if (value in state.selectedProviders) state.selectedProviders - value else state.selectedProviders + value); load(signedIn) }
}

@Composable
fun HomeRoute(signedIn: Boolean, onOpenMedia: (String, Int) -> Unit, onOpenList: (String) -> Unit, viewModel: HomeViewModel = hiltViewModel()) {
    LaunchedEffect(signedIn) { viewModel.load(signedIn) }
    HomeScreen(viewModel.state, { viewModel.load(signedIn) }, onOpenMedia, onOpenList,
        { viewModel.selectMood(it, signedIn) }, { viewModel.selectRuntime(it, signedIn) }, { viewModel.toggleProvider(it, signedIn) })
}

@Composable
fun HomeScreen(state: HomeUiState, onRetry: () -> Unit, onOpenMedia: (String, Int) -> Unit, onOpenList: (String) -> Unit, onMood: (String?) -> Unit, onRuntime: (Int?) -> Unit, onProvider: (Int) -> Unit) {
    when {
        state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
        state.error != null -> Column(Modifier.padding(24.dp)) { Text(state.error); Button(onClick = onRetry) { Text(stringResource(DR.string.retry)) } }
        else -> androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            item { Text(stringResource(DR.string.your_cinema), style = MaterialTheme.typography.headlineMedium) }
            item { MediaRail(stringResource(DR.string.continue_watching), state.continueWatching, onOpenMedia) }
            item { Text(stringResource(DR.string.mood), style = MaterialTheme.typography.titleMedium); LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { FilterChip(state.selectedMood == null, { onMood(null) }, { Text(stringResource(DR.string.any)) }) }
                items(state.moods) { mood -> FilterChip(state.selectedMood == mood.id.name.lowercase().replace('_', '-'), { onMood(mood.id.name.lowercase().replace('_', '-')) }, { Text(mood.label) }) }
            } }
            item { Text(stringResource(DR.string.runtime), style = MaterialTheme.typography.titleMedium); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf(null to stringResource(DR.string.any), 30 to "30m", 60 to "60m", 120 to "120m").forEach { (minutes, label) -> FilterChip(state.maxMinutes == minutes, { onRuntime(minutes) }, { Text(label) }) } } }
            item { Text(stringResource(DR.string.providers), style = MaterialTheme.typography.titleMedium); LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { items(state.providers) { provider -> FilterChip(provider.id in state.selectedProviders, { onProvider(provider.id) }, { Text(provider.name) }) } } }
            state.rails.forEach { rail -> item { Column { Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) { Text(rail.title, style = MaterialTheme.typography.titleLarge); TextButton(onClick = { onOpenList(rail.id) }) { Text(stringResource(DR.string.more)) } }; Text(rail.reason); MediaRail("", rail.items, onOpenMedia) } } }
            item { MediaRail(stringResource(DR.string.trending_tv), state.tv, onOpenMedia) }
            item { MediaRail(stringResource(DR.string.trending_movies), state.movies, onOpenMedia) }
        }
    }
}

@Composable private fun MediaRail(title: String, media: List<MediaSummary>, onOpenMedia: (String, Int) -> Unit) {
    Column { if (title.isNotBlank()) Text(title, style = MaterialTheme.typography.titleLarge); if (media.isEmpty()) Text(stringResource(DR.string.nothing_queued)) else LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items(media) { item -> Column(Modifier.width(120.dp).clickable { onOpenMedia(item.mediaType.wireValue, item.id) }) { AsyncImage(item.images.poster, item.title, Modifier.height(170.dp).fillMaxWidth()); Text(item.title, maxLines = 2) } }
    }}
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)
