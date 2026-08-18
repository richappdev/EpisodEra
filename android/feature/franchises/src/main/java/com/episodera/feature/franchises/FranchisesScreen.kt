package com.episodera.feature.franchises

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.model.FranchiseOrder
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FranchiseSummary(val slug: String, val title: String)
data class FranchiseMedia(val id: Int, val type: String, val title: String)
data class FranchiseDetail(val title: String, val watched: Int, val total: Int, val releaseOrder: List<FranchiseMedia>, val chronologicalOrder: List<FranchiseMedia>)
data class FranchisesUiState(val items: List<FranchiseSummary> = emptyList(), val detail: FranchiseDetail? = null, val loading: Boolean = true, val error: String? = null)

@HiltViewModel
class FranchisesViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(FranchisesUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }
    private fun refresh() = viewModelScope.launch {
        runCatching { repository.franchises().items.map { FranchiseSummary(it.slug, it.name) } }
            .onSuccess { _uiState.value = FranchisesUiState(items = it, loading = false) }
            .onFailure { _uiState.value = FranchisesUiState(loading = false, error = it.message ?: "Unable to load franchises") }
    }
    fun select(slug: String, signedIn: Boolean) = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        runCatching {
            val catalog = repository.franchise(slug)
            if (signedIn) {
                val release = repository.franchiseProgress(slug, FranchiseOrder.RELEASE)
                val chronological = repository.franchiseProgress(slug, FranchiseOrder.CHRONOLOGICAL)
                FranchiseDetail(catalog.name, release.watchedTitles, release.totalTitles,
                    release.titles.map { FranchiseMedia(it.tmdbId, it.mediaType.wireValue, it.title) },
                    chronological.titles.map { FranchiseMedia(it.tmdbId, it.mediaType.wireValue, it.title) })
            } else {
                FranchiseDetail(catalog.name, 0, catalog.titles.size,
                    catalog.titles.sortedBy { it.releaseOrder }.map { FranchiseMedia(it.tmdbId, it.mediaType.wireValue, it.title) },
                    catalog.titles.sortedBy { it.chronologicalOrder }.map { FranchiseMedia(it.tmdbId, it.mediaType.wireValue, it.title) })
            }
        }.onSuccess { _uiState.value = _uiState.value.copy(detail = it, loading = false) }
            .onFailure { _uiState.value = _uiState.value.copy(loading = false, error = it.message ?: "Unable to load franchise") }
    }
    fun clearDetail() { _uiState.value = _uiState.value.copy(detail = null, error = null) }
}

@Composable
fun FranchisesRoute(signedIn: Boolean, initialSlug: String? = null, onOpenMedia: (String, Int) -> Unit, viewModel: FranchisesViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(initialSlug, signedIn) { initialSlug?.let { viewModel.select(it, signedIn) } }
    FranchisesScreen(state, { viewModel.select(it, signedIn) }, viewModel::clearDetail, onOpenMedia)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FranchisesScreen(state: FranchisesUiState, onSelect: (String) -> Unit, onBack: () -> Unit, onOpenMedia: (String, Int) -> Unit) {
    var chronological by rememberSaveable(state.detail?.title) { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(state.detail?.title ?: stringResource(DR.string.franchises)) })
        if (state.detail != null) TextButton(onClick = onBack) { Text(stringResource(DR.string.back_franchises)) }
        state.error?.let { Text(it, Modifier.padding(16.dp)) }
        state.detail?.let { detail ->
            val progress = if (detail.total == 0) 0f else detail.watched.toFloat() / detail.total
            Text(stringResource(DR.string.franchise_progress, detail.watched, detail.total), Modifier.padding(16.dp))
            LinearProgressIndicator(progress = { progress }, Modifier.padding(horizontal = 16.dp))
            FilterChip(selected = chronological, onClick = { chronological = !chronological }, label = { Text(stringResource(if (chronological) DR.string.chronological_order else DR.string.release_order)) })
            LazyColumn(Modifier.padding(16.dp)) {
                val titles = if (chronological) detail.chronologicalOrder else detail.releaseOrder
                items(titles.size) { index -> val media = titles[index]; Text(media.title, Modifier.clickable { onOpenMedia(media.type, media.id) }.padding(vertical = 12.dp)) }
            }
        } ?: if (state.loading) Text(stringResource(DR.string.loading_franchises), Modifier.padding(24.dp)) else LazyColumn(Modifier.padding(16.dp)) {
            items(state.items.size) { index -> val franchise = state.items[index]; Text(franchise.title, Modifier.clickable { onSelect(franchise.slug) }.padding(vertical = 12.dp)) }
        }
    }
}
