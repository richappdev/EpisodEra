package com.episodera.feature.likes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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

data class LikedTitle(val itemId: String, val mediaId: Int, val mediaType: String, val title: String, val posterUrl: String? = null)
data class LikesUiState(val items: List<LikedTitle> = emptyList(), val loading: Boolean = true, val error: String? = null)

@HiltViewModel
class LikesViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(LikesUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _uiState.value = LikesUiState(loading = true)
        runCatching { repository.likes().items.map { LikedTitle(it.itemId, it.tmdbId, it.mediaType.wireValue, it.title, it.poster) } }
            .onSuccess { _uiState.value = LikesUiState(items = it, loading = false) }
            .onFailure { _uiState.value = LikesUiState(loading = false, error = it.message ?: "Unable to load likes") }
    }
    fun unlike(itemId: String) = viewModelScope.launch {
        runCatching { repository.removeLike(itemId) }.onSuccess { refresh() }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message) }
    }
}

@Composable
fun LikesRoute(onOpenDetail: (String, Int) -> Unit, viewModel: LikesViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LikesScreen(state, viewModel::unlike, onOpenDetail)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LikesScreen(state: LikesUiState, onUnlike: (String) -> Unit, onOpenDetail: (String, Int) -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Liked titles") })
        when {
            state.loading -> Text("Loading likes…", Modifier.padding(24.dp))
            state.error != null -> Text(state.error, Modifier.padding(24.dp))
            state.items.isEmpty() -> Text("Titles you like will appear here.", Modifier.padding(24.dp))
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(140.dp),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.items, key = { it.itemId }) { item ->
                    Card(Modifier.fillMaxWidth().clickable { onOpenDetail(item.mediaType, item.mediaId) }) {
                        Column(Modifier.padding(12.dp)) {
                            Text(item.title)
                            Text(item.mediaType.uppercase())
                            TextButton(onClick = { onUnlike(item.itemId) }) { Text("Unlike") }
                        }
                    }
                }
            }
        }
    }
}
