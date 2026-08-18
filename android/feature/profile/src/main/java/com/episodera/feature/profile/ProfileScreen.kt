package com.episodera.feature.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.episodera.core.model.*
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Year
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProfileUiState(
    val displayName: String = "",
    val stats: UserStats? = null,
    val recap: YearRecap? = null,
    val recapYear: Int = Year.now().value,
    val achievements: List<AchievementProgress> = emptyList(),
    val history: List<HistoryEntry> = emptyList(),
    val historyToken: String? = null,
    val historyHasMore: Boolean = false,
    val loading: Boolean = true,
    val loadingMore: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
    private val auth: FirebaseAuth,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        val profile = async { runCatching { repository.profile().profile } }
        val stats = async { runCatching { repository.stats() } }
        val recap = async { runCatching { repository.recap(_uiState.value.recapYear) } }
        val achievements = async { runCatching { repository.achievements().items } }
        val history = async { runCatching { repository.history(PaginationParams(pageSize = 25)) } }
        val p = profile.await(); val s = stats.await(); val r = recap.await(); val a = achievements.await(); val h = history.await()
        val value = p.getOrNull()
        _uiState.value = _uiState.value.copy(
            displayName = value?.displayName ?: listOfNotNull(value?.firstName, value?.lastName).joinToString(" "),
            stats = s.getOrNull(), recap = r.getOrNull(), achievements = a.getOrDefault(emptyList()),
            history = h.getOrNull()?.items.orEmpty(), historyToken = h.getOrNull()?.nextPageToken,
            historyHasMore = h.getOrNull()?.hasMore == true, loading = false,
            error = listOf(p, s, r, a, h).firstNotNullOfOrNull { it.exceptionOrNull()?.message },
        )
    }

    fun loadRecap(year: Int) = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(recapYear = year, recap = null)
        runCatching { repository.recap(year) }.onSuccess { _uiState.value = _uiState.value.copy(recap = it) }
            .onFailure { _uiState.value = _uiState.value.copy(error = it.message) }
    }

    fun loadMoreHistory() = viewModelScope.launch {
        val current = _uiState.value
        if (!current.historyHasMore || current.loadingMore) return@launch
        _uiState.value = current.copy(loadingMore = true)
        runCatching { repository.history(PaginationParams(pageSize = 25, pageToken = current.historyToken)) }
            .onSuccess { page -> _uiState.value = _uiState.value.copy(history = (_uiState.value.history + page.items).distinctBy { it.historyId }, historyToken = page.nextPageToken, historyHasMore = page.hasMore, loadingMore = false) }
            .onFailure { _uiState.value = _uiState.value.copy(loadingMore = false, error = it.message) }
    }
    fun signOut() = auth.signOut()
}

@Composable
fun ProfileRoute(onSignOut: () -> Unit, viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ProfileScreen(state, viewModel::refresh, viewModel::loadRecap, viewModel::loadMoreHistory) { viewModel.signOut(); onSignOut() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(state: ProfileUiState, onRetry: () -> Unit, onRecapYear: (Int) -> Unit, onLoadMore: () -> Unit, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(if (state.displayName.isBlank()) stringResource(DR.string.profile) else state.displayName) })
        if (state.loading) CircularProgressIndicator(Modifier.padding(24.dp)) else LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            state.error?.let { item { Row(Modifier.padding(16.dp)) { Text(it, Modifier.weight(1f)); TextButton(onClick = onRetry) { Text(stringResource(DR.string.retry)) } } } }
            state.stats?.let { stats -> item { Row(Modifier.fillMaxWidth().padding(16.dp), Arrangement.SpaceBetween) {
                Stat(stringResource(DR.string.movies), stats.totalWatchedMovies.toString()); Stat(stringResource(DR.string.episodes), stats.totalWatchedEpisodes.toString()); Stat(stringResource(DR.string.streak), "${stats.currentStreakDays}d")
            } } }
            item { Card(Modifier.padding(horizontal = 16.dp)) { Column(Modifier.padding(16.dp)) {
                Text(stringResource(DR.string.year_recap))
                Row { TextButton(onClick = { onRecapYear(state.recapYear - 1) }) { Text("‹") }; Text(state.recapYear.toString(), Modifier.padding(12.dp)); TextButton(onClick = { onRecapYear(state.recapYear + 1) }, enabled = state.recapYear < Year.now().value) { Text("›") } }
                state.recap?.let { Text(stringResource(DR.string.recap_counts, it.totalWatchedMovies, it.totalWatchedEpisodes)) } ?: Text(stringResource(DR.string.loading_recap))
            } } }
            item { Card(Modifier.padding(horizontal = 16.dp)) { Column(Modifier.padding(16.dp)) {
                Text(stringResource(DR.string.achievements))
                if (state.achievements.isEmpty()) Text(stringResource(DR.string.no_achievements))
                state.achievements.forEach { Text("${if (it.unlocked) "✓" else "○"} ${it.title} · ${it.current}/${it.target}") }
            } } }
            item { Text(stringResource(DR.string.recently_watched), Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.titleLarge) }
            items(state.history.size, key = { state.history[it].historyId }) { i -> val entry = state.history[i]; Text("${entry.title}${entry.episodeTitle?.let { " · $it" }.orEmpty()}", Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) }
            if (state.historyHasMore) item { TextButton(onClick = onLoadMore, enabled = !state.loadingMore, modifier = Modifier.padding(horizontal = 16.dp)) { Text(stringResource(if (state.loadingMore) DR.string.loading else DR.string.load_more_history)) } }
            item { TextButton(onClick = onSignOut, modifier = Modifier.padding(16.dp)) { Text(stringResource(DR.string.sign_out)) } }
        }
    }
}

@Composable private fun Stat(label: String, value: String) { Column { Text(value); Text(label) } }
