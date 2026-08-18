package com.episodera.feature.puzzle

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.GuessRequest
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import com.episodera.core.network.PreferencesStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PuzzleChoice(val id: String, val title: String)
data class PuzzleUiState(val imageUrl: String? = null, val choices: List<PuzzleChoice> = emptyList(), val attempts: Int = 0, val maxAttempts: Int = 3, val hint: String? = null, val result: String? = null, val signedInStats: String? = null, val selectedIds: Set<String> = emptySet(), val completed: Boolean = false, val loading: Boolean = true, val guessing: Boolean = false, val error: String? = null)

@HiltViewModel
class PuzzleViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
    private val preferences: PreferencesStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PuzzleUiState())
    val uiState = _uiState.asStateFlow()
    private var puzzleId: String? = null
    fun load(signedIn: Boolean) = viewModelScope.launch {
        _uiState.value = PuzzleUiState(loading = true)
        runCatching { repository.puzzleToday() }.onSuccess { puzzle ->
            puzzleId = puzzle.puzzleId
            val attempt = puzzle.attempt
            _uiState.value = PuzzleUiState(puzzle.mobileImageUrl ?: puzzle.imageUrl, puzzle.choices.map { PuzzleChoice(it.choiceId, it.title) },
                attempt?.attemptCount ?: 0, puzzle.maxAttempts,
                attempt?.hints?.lastOrNull()?.value,
                attempt?.answer?.let { if (attempt.completed) it.title else null },
                selectedIds = attempt?.selectedChoiceIds.orEmpty().toSet(), completed = attempt?.completed == true, loading = false)
            if (signedIn) runCatching { repository.puzzleStats() }.onSuccess { stats ->
                _uiState.value = _uiState.value.copy(signedInStats = "${stats.gamesWon}/${stats.gamesPlayed} wins · ${stats.currentStreak} day streak")
            }
        }.onFailure { _uiState.value = PuzzleUiState(loading = false, error = it.message ?: "Unable to load puzzle") }
    }
    fun guess(choice: PuzzleChoice) = viewModelScope.launch {
        val id = puzzleId ?: return@launch
        if (_uiState.value.completed || _uiState.value.guessing || choice.id in _uiState.value.selectedIds) return@launch
        _uiState.value = _uiState.value.copy(guessing = true, error = null)
        runCatching { repository.guessPuzzle(id, GuessRequest(choice.id)) }.onSuccess { response ->
            _uiState.value = _uiState.value.copy(attempts = response.attempt, hint = response.hint?.value,
                result = if (response.completed) if (response.won) "Correct: ${response.answer?.title.orEmpty()}" else "Puzzle complete" else "Not quite—try again.",
                selectedIds = response.selectedChoiceIds.toSet(), completed = response.completed, guessing = false)
        }.onFailure { _uiState.value = _uiState.value.copy(guessing = false, error = it.message ?: "Unable to submit guess") }
    }
}

@Composable
fun PuzzleRoute(signedIn: Boolean, viewModel: PuzzleViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(signedIn) { viewModel.load(signedIn) }
    PuzzleScreen(state, viewModel::guess, { viewModel.load(signedIn) })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PuzzleScreen(state: PuzzleUiState, onGuess: (PuzzleChoice) -> Unit, onRetry: () -> Unit) {
    val context = LocalContext.current
    val shareLabel = stringResource(DR.string.share)
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(stringResource(DR.string.todays_puzzle)) })
        if (state.loading) Text(stringResource(DR.string.loading_puzzle), Modifier.padding(24.dp)) else {
            state.error?.let { Text(it, Modifier.padding(16.dp)); Button(onClick = onRetry, modifier = Modifier.padding(horizontal = 16.dp)) { Text(stringResource(DR.string.retry)) } }
            state.imageUrl?.let { AsyncImage(model = it, contentDescription = stringResource(DR.string.puzzle_image), modifier = Modifier.fillMaxWidth().padding(16.dp)) }
            Text(stringResource(DR.string.attempts, state.attempts, state.maxAttempts), Modifier.padding(horizontal = 16.dp))
            state.choices.forEach { choice -> Button(enabled = !state.completed && !state.guessing && choice.id !in state.selectedIds, onClick = { onGuess(choice) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) { Text(choice.title) } }
            state.hint?.let { Text(it, Modifier.padding(16.dp)) }
            state.result?.let { result ->
                Card(Modifier.padding(16.dp)) { Column(Modifier.padding(16.dp)) { Text(result); Button(onClick = { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "EpisodEra · ${state.attempts}/${state.maxAttempts}" ) }, shareLabel)) }) { Text(shareLabel) } } }
            }
            state.signedInStats?.let { Text(it, Modifier.padding(16.dp)) }
        }
    }
}
