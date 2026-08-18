package com.episodera.feature.timeline

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.episodera.core.model.*
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class TimelineGroup { DAY, MONTH, YEAR }
enum class TimelineMediaFilter { ALL, MOVIE, TV }

data class TimelineUiState(
    val entries: List<HistoryEntry> = emptyList(),
    val nextPageToken: String? = null,
    val hasMore: Boolean = false,
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val mutatingId: String? = null,
    val error: String? = null,
)

internal fun filterTimeline(
    entries: List<HistoryEntry>,
    query: String,
    media: TimelineMediaFilter,
    rewatchesOnly: Boolean,
): List<HistoryEntry> = entries.filter { entry ->
    (query.isBlank() || entry.title.contains(query, true) || entry.episodeTitle.orEmpty().contains(query, true)) &&
        (media == TimelineMediaFilter.ALL || entry.mediaType.wireValue == media.name.lowercase()) &&
        (!rewatchesOnly || (entry.rewatchCount ?: 0) > 0)
}

@HiltViewModel
class TimelineViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(TimelineUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _uiState.value = TimelineUiState(loading = true)
        loadPage(null, false)
    }

    fun loadMore() = viewModelScope.launch {
        val current = _uiState.value
        if (!current.hasMore || current.loadingMore) return@launch
        _uiState.value = current.copy(loadingMore = true, error = null)
        loadPage(current.nextPageToken, true)
    }

    private suspend fun loadPage(token: String?, append: Boolean) {
        runCatching { repository.history(PaginationParams(pageSize = 50, pageToken = token)) }
            .onSuccess { page ->
                val items = if (append) (_uiState.value.entries + page.items).distinctBy { it.historyId } else page.items
                _uiState.value = _uiState.value.copy(entries = items, nextPageToken = page.nextPageToken,
                    hasMore = page.hasMore, loading = false, loadingMore = false)
            }
            .onFailure { _uiState.value = _uiState.value.copy(loading = false, loadingMore = false, error = it.message ?: "Unable to load history") }
    }

    fun update(entry: HistoryEntry, watchedAt: String) = mutate(entry.historyId) {
        val updated = repository.updateHistory(entry.historyId, UpdateHistoryInput(watchedAt))
        _uiState.value = _uiState.value.copy(entries = _uiState.value.entries.map { if (it.historyId == entry.historyId) updated else it })
    }

    fun delete(entry: HistoryEntry) = mutate(entry.historyId) {
        repository.deleteHistory(entry.historyId)
        _uiState.value = _uiState.value.copy(entries = _uiState.value.entries.filterNot { it.historyId == entry.historyId })
    }

    private fun mutate(id: String, action: suspend () -> Unit) = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(mutatingId = id, error = null)
        runCatching { action() }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message ?: "Unable to update history") }
        _uiState.value = _uiState.value.copy(mutatingId = null)
    }
}

@Composable
fun TimelineRoute(
    onOpenDetail: (String, Int) -> Unit,
    viewModel: TimelineViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    TimelineScreen(state, onOpenDetail, viewModel::refresh, viewModel::loadMore, viewModel::update, viewModel::delete)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimelineScreen(
    state: TimelineUiState,
    onOpenDetail: (String, Int) -> Unit,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onUpdate: (HistoryEntry, String) -> Unit,
    onDelete: (HistoryEntry) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf(TimelineGroup.DAY) }
    var media by rememberSaveable { mutableStateOf(TimelineMediaFilter.ALL) }
    var rewatchesOnly by rememberSaveable { mutableStateOf(false) }
    var editingId by rememberSaveable { mutableStateOf<String?>(null) }
    var watchedAtDraft by rememberSaveable { mutableStateOf("") }
    var deleteEntry by remember { mutableStateOf<HistoryEntry?>(null) }

    val visible = filterTimeline(state.entries, query, media, rewatchesOnly)
    val grouped = visible.groupBy {
        val value = it.watchedAt ?: it.updatedAt.orEmpty()
        when (group) { TimelineGroup.DAY -> value.take(10); TimelineGroup.MONTH -> value.take(7); TimelineGroup.YEAR -> value.take(4) }
    }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(stringResource(DR.string.timeline)) })
        Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text(stringResource(DR.string.timeline_search)) }, singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TimelineMediaFilter.entries.forEach { option -> FilterChip(media == option, { media = option }, { Text(stringResource(when (option) { TimelineMediaFilter.ALL -> DR.string.all; TimelineMediaFilter.MOVIE -> DR.string.movie; TimelineMediaFilter.TV -> DR.string.tv })) }) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TimelineGroup.entries.forEach { option -> FilterChip(group == option, { group = option }, { Text(stringResource(when (option) { TimelineGroup.DAY -> DR.string.day; TimelineGroup.MONTH -> DR.string.month; TimelineGroup.YEAR -> DR.string.year })) }) }
                FilterChip(rewatchesOnly, { rewatchesOnly = !rewatchesOnly }, { Text(stringResource(DR.string.rewatches)) })
            }
        }
        when {
            state.loading -> CircularProgressIndicator(Modifier.padding(24.dp))
            state.error != null && state.entries.isEmpty() -> Column(Modifier.padding(24.dp)) { Text(state.error); Button(onClick = onRetry) { Text(stringResource(DR.string.retry)) } }
            visible.isEmpty() -> Text(stringResource(DR.string.history_empty), Modifier.padding(24.dp))
            else -> LazyColumn(contentPadding = PaddingValues(16.dp)) {
                grouped.forEach { (date, entries) ->
                    item("header-$date") { Text(date.ifBlank { stringResource(DR.string.unknown_date) }, style = MaterialTheme.typography.titleMedium) }
                    items(entries.size, key = { entries[it].historyId }) { index ->
                        val entry = entries[index]
                        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                            Text(entry.title, Modifier.clickable { onOpenDetail(entry.mediaType.wireValue, entry.tmdbId) })
                            Text(if (entry.mediaType == MediaType.TV) "S${entry.seasonNumber} E${entry.episodeNumber} · ${entry.episodeTitle.orEmpty()}" else stringResource(DR.string.movie))
                            if (editingId == entry.historyId) {
                                OutlinedTextField(watchedAtDraft, { watchedAtDraft = it }, label = { Text(stringResource(DR.string.watched_time)) })
                                Row { Button(onClick = { onUpdate(entry, watchedAtDraft); editingId = null }) { Text(stringResource(DR.string.save)) }; TextButton(onClick = { editingId = null }) { Text(stringResource(DR.string.cancel)) } }
                            } else Row {
                                TextButton(onClick = { editingId = entry.historyId; watchedAtDraft = entry.watchedAt.orEmpty() }) { Text(stringResource(DR.string.edit_time)) }
                                TextButton(onClick = { deleteEntry = entry }) { Text(stringResource(DR.string.delete)) }
                            }
                            if (state.mutatingId == entry.historyId) LinearProgressIndicator(Modifier.fillMaxWidth())
                            HorizontalDivider()
                        }
                    }
                }
                if (state.hasMore) item("load-more") { Button(onClick = onLoadMore, enabled = !state.loadingMore) { Text(stringResource(if (state.loadingMore) DR.string.loading else DR.string.load_more)) } }
            }
        }
    }
    deleteEntry?.let { entry ->
        AlertDialog(onDismissRequest = { deleteEntry = null }, title = { Text(stringResource(DR.string.remove_history_title)) },
            text = { Text(stringResource(DR.string.remove_history_body)) },
            confirmButton = { Button(onClick = { onDelete(entry); deleteEntry = null }) { Text(stringResource(DR.string.remove)) } },
            dismissButton = { TextButton(onClick = { deleteEntry = null }) { Text(stringResource(DR.string.cancel)) } })
    }
}
