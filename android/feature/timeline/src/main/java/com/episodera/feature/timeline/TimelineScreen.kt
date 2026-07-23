package com.episodera.feature.timeline

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HistoryItem(val id: String, val title: String, val season: Int? = null, val episode: Int? = null, val watchedAt: String)
data class TimelineUiState(val entries: List<HistoryItem> = emptyList(), val groupByMonth: Boolean = false, val filter: String? = null, val loading: Boolean = true)

@HiltViewModel
class TimelineViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(TimelineUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch {
        runCatching {
            repository.history().items.map {
                HistoryItem(it.historyId, it.title, it.seasonNumber, it.episodeNumber, it.watchedAt ?: it.updatedAt.orEmpty())
            }
        }.onSuccess { _uiState.value = _uiState.value.copy(entries = it, loading = false) }
            .onFailure { _uiState.value = _uiState.value.copy(loading = false) }
    }
    fun setMonthly(value: Boolean) { _uiState.value = _uiState.value.copy(groupByMonth = value) }
    fun setFilter(value: String?) { _uiState.value = _uiState.value.copy(filter = value) }
}

@Composable
fun TimelineRoute(viewModel: TimelineViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    TimelineScreen(state, viewModel::setMonthly)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimelineScreen(state: TimelineUiState, onGroupByMonth: (Boolean) -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Watch history") }, actions = {
            FilterChip(selected = state.groupByMonth, onClick = { onGroupByMonth(!state.groupByMonth) }, label = { Text(if (state.groupByMonth) "By month" else "By day") })
        })
        if (state.loading) Text("Loading history…", Modifier.padding(24.dp))
        else LazyColumn(contentPadding = PaddingValues(16.dp)) {
            val groups = state.entries.groupBy { item ->
                if (state.groupByMonth) item.watchedAt.take(7) else item.watchedAt.take(10)
            }
            groups.forEach { (date, entries) ->
                item(date) { Text(date, Modifier.padding(vertical = 8.dp)) }
                items(entries.size, key = { entries[it].id }) { index ->
                    val item = entries[index]
                    Column(Modifier.padding(vertical = 10.dp)) {
                        Text(item.title)
                        Text(buildString {
                            if (item.season != null) append("S${item.season} E${item.episode} · ")
                            append(item.watchedAt)
                        })
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}
