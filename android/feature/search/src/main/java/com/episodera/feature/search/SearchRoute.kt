package com.episodera.feature.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.MediaSummary
import com.episodera.core.network.EpisodEraRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*

@OptIn(FlowPreview::class)
@HiltViewModel class SearchViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    var text by mutableStateOf(""); private set
    var results by mutableStateOf<List<MediaSummary>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    init { query.debounce(350).filter { it.length >= 2 }.onEach { search(it) }.launchIn(viewModelScope) }
    fun setQuery(value: String) { text = value; if (value.length < 2) results = emptyList(); query.value = value }
    private suspend fun search(value: String) { loading = true; error = null; runCatching { repository.search(value) }
        .onSuccess { results = it.tv.results + it.movies.results }.onFailure { error = it.message ?: "Search failed" }; loading = false }
}

@Composable fun SearchRoute(onOpenMedia: (String, Int) -> Unit, viewModel: SearchViewModel = hiltViewModel()) = SearchScreen(viewModel.text, viewModel.results, viewModel.loading, viewModel.error, viewModel::setQuery, onOpenMedia)
@Composable fun SearchScreen(query: String, results: List<MediaSummary>, loading: Boolean, error: String?, onQuery: (String) -> Unit, onOpenMedia: (String, Int) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        OutlinedTextField(query, onQuery, Modifier.fillMaxWidth(), label = { Text("Search films and shows") }, singleLine = true)
        Spacer(Modifier.height(12.dp))
        when { loading -> LinearProgressIndicator(Modifier.fillMaxWidth()); error != null -> Text(error, color = MaterialTheme.colorScheme.error)
            query.length < 2 -> Text("Type at least two characters to search.")
            results.isEmpty() -> Text("No titles found.")
            else -> LazyVerticalGrid(GridCells.Fixed(2), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(results) { item -> Column(Modifier.clickable { onOpenMedia(item.mediaType.wireValue, item.id) }) { AsyncImage(item.images.poster, item.title, Modifier.fillMaxWidth().height(230.dp)); Text(item.title, maxLines = 2) } }
            }
        }
    }
}
