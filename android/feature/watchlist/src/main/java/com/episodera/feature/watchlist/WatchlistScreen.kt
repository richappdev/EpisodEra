package com.episodera.feature.watchlist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.model.WatchlistStatus
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class WatchlistTab { ACTIVE, CONTINUE_WATCHING, LIBRARY }

data class WatchlistTitle(
    val id: String,
    val mediaId: Int,
    val mediaType: String,
    val title: String,
    val status: String,
    val nextEpisode: String? = null,
    val nextSeason: Int? = null,
    val nextNumber: Int? = null,
    val watchlistItem: Boolean = true,
)

data class WatchlistUiState(
    val selectedTab: WatchlistTab = WatchlistTab.ACTIVE,
    val titles: List<WatchlistTitle> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class WatchlistViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(WatchlistUiState())
    val uiState = _uiState.asStateFlow()

    fun selectTab(tab: WatchlistTab) { _uiState.value = _uiState.value.copy(selectedTab = tab) }
    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        runCatching {
            val progress = repository.allProgress().associateBy { it.tmdbId }
            val watchlist = repository.allWatchlist()
            val watchlistTitles = watchlist.map { item ->
                val next = progress[item.tmdbId]?.nextEpisode
                WatchlistTitle(item.itemId, item.tmdbId, item.mediaType.wireValue, item.title, item.status.name.lowercase(),
                    next?.let { "S${it.seasonNumber}E${it.episodeNumber} ${it.episodeTitle}" }, next?.seasonNumber, next?.episodeNumber)
            }
            val knownIds = watchlist.map { it.tmdbId }.toSet()
            watchlistTitles + progress.values.filter { it.tmdbId !in knownIds }.map { item ->
                WatchlistTitle("progress:${item.showId}", item.tmdbId, "tv", item.title, "watching",
                    item.nextEpisode?.let { "S${it.seasonNumber}E${it.episodeNumber} ${it.episodeTitle}" },
                    item.nextEpisode?.seasonNumber, item.nextEpisode?.episodeNumber, watchlistItem = false)
            }
        }.onSuccess { _uiState.value = _uiState.value.copy(titles = it, isLoading = false) }
            .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.message ?: "Unable to load watchlist") }
    }
    fun changeStatus(itemId: String, status: String) = viewModelScope.launch {
        val parsed = WatchlistStatus.entries.firstOrNull { it.name == status.uppercase() } ?: return@launch
        runCatching { repository.updateWatchlist(itemId, parsed) }.onSuccess { refresh() }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message) }
    }
    fun remove(itemId: String) = viewModelScope.launch {
        runCatching { repository.removeWatchlist(itemId) }.onSuccess { refresh() }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message) }
    }
    fun markNext(item: WatchlistTitle) = viewModelScope.launch {
        val season = item.nextSeason ?: return@launch
        val episode = item.nextNumber ?: return@launch
        runCatching { repository.markEpisode(item.mediaId, com.episodera.core.model.MarkEpisodeWatchedInput(season, episode)) }
            .onSuccess { refresh() }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message) }
    }
}

@Composable
fun WatchlistRoute(onOpenDetail: (mediaType: String, mediaId: Int) -> Unit, viewModel: WatchlistViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    WatchlistScreen(state, viewModel::selectTab, viewModel::changeStatus, viewModel::remove, viewModel::markNext, onOpenDetail, viewModel::refresh)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WatchlistScreen(
    state: WatchlistUiState,
    onTab: (WatchlistTab) -> Unit,
    onStatus: (String, String) -> Unit,
    onRemove: (String) -> Unit,
    onMarkNext: (WatchlistTitle) -> Unit,
    onOpenDetail: (String, Int) -> Unit,
    onRetry: () -> Unit,
) {
    val visible = when (state.selectedTab) {
        WatchlistTab.ACTIVE -> state.titles.filter { it.status in setOf("watching", "unwatched") }
        WatchlistTab.CONTINUE_WATCHING -> state.titles.filter { it.nextEpisode != null }
        WatchlistTab.LIBRARY -> state.titles.filter { it.status !in setOf("watching", "unwatched") }
    }
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(stringResource(DR.string.watchlist)) })
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            WatchlistTab.entries.forEach { tab -> FilterChip(selected = state.selectedTab == tab, onClick = { onTab(tab) }, label = { Text(tab.name.replace('_', ' ')) }) }
        }
        when {
            state.isLoading -> Text(stringResource(DR.string.loading_watchlist), Modifier.padding(24.dp))
            state.error != null -> Column(Modifier.padding(24.dp)) { Text(state.error); Button(onClick = onRetry) { Text(stringResource(DR.string.retry)) } }
            visible.isEmpty() -> Text(stringResource(DR.string.nothing_here), Modifier.padding(24.dp))
            else -> LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(visible.size, key = { visible[it].id }) { index ->
                    val item = visible[index]
                    var menuExpanded by remember(item.id) { mutableStateOf(false) }
                    Column(Modifier.fillMaxWidth()) {
                        TextButton(onClick = { onOpenDetail(item.mediaType, item.mediaId) }) { Text(item.title) }
                        item.nextEpisode?.let { Text(stringResource(DR.string.continue_with, it)); Button(onClick = { onMarkNext(item) }) { Text(stringResource(DR.string.mark_next_watched)) } }
                        if (item.watchlistItem) ExposedDropdownMenuBox(expanded = menuExpanded, onExpandedChange = { menuExpanded = it }) {
                            OutlinedButton(onClick = { menuExpanded = true }, modifier = Modifier.menuAnchor()) { Text(item.status) }
                            ExposedDropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                                listOf("planned", "watching", "completed", "dropped", "watched").forEach { status ->
                                    DropdownMenuItem(text = { Text(status) }, onClick = { onStatus(item.id, status); menuExpanded = false })
                                }
                            }
                        }
                        if (item.watchlistItem) TextButton(onClick = { onRemove(item.id) }) { Text(stringResource(DR.string.remove)) }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
