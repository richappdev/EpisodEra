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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.episodera.core.model.GuessRequest
import com.episodera.core.network.EpisodEraRepository
import com.episodera.core.network.PreferencesStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PuzzleChoice(val id: String, val title: String)
data class PuzzleUiState(val imageUrl: String? = null, val choices: List<PuzzleChoice> = emptyList(), val attempts: Int = 0, val maxAttempts: Int = 3, val hint: String? = null, val result: String? = null, val signedInStats: String? = null, val loading: Boolean = true)

@HiltViewModel
class PuzzleViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
    private val preferences: PreferencesStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PuzzleUiState())
    val uiState = _uiState.asStateFlow()
    private var puzzleId: String? = null
    init { load() }
    private fun load() = viewModelScope.launch {
        runCatching { repository.puzzleToday() }.onSuccess { puzzle ->
            puzzleId = puzzle.puzzleId
            _uiState.value = PuzzleUiState(puzzle.imageUrl, puzzle.choices.map { PuzzleChoice(it.choiceId, it.title) },
                puzzle.attempt?.attemptCount ?: 0, puzzle.maxAttempts,
                puzzle.attempt?.hints?.lastOrNull()?.value,
                puzzle.attempt?.answer?.let { if (puzzle.attempt.completed) it.title else null }, loading = false)
            runCatching { repository.puzzleStats() }.onSuccess { stats ->
                _uiState.value = _uiState.value.copy(signedInStats = "${stats.gamesWon}/${stats.gamesPlayed} wins · ${stats.currentStreak} day streak")
            }
        }.onFailure { _uiState.value = PuzzleUiState(loading = false, result = it.message ?: "Unable to load puzzle") }
    }
    fun guess(choice: PuzzleChoice) = viewModelScope.launch {
        val id = puzzleId ?: return@launch
        runCatching { repository.guessPuzzle(id, GuessRequest(choice.id)) }.onSuccess { response ->
            _uiState.value = _uiState.value.copy(attempts = response.attempt, hint = response.hint?.value,
                result = if (response.completed) if (response.won) "Correct: ${response.answer?.title.orEmpty()}" else "Puzzle complete" else "Not quite—try again.")
        }
    }
    fun hint() { _uiState.value = _uiState.value.copy(hint = "A hint is revealed after an attempt.") }
}

@Composable
fun PuzzleRoute(viewModel: PuzzleViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    PuzzleScreen(state, viewModel::guess, viewModel::hint)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PuzzleScreen(state: PuzzleUiState, onGuess: (PuzzleChoice) -> Unit, onHint: () -> Unit) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Today's puzzle") })
        if (state.loading) Text("Loading today's puzzle…", Modifier.padding(24.dp)) else {
            state.imageUrl?.let { AsyncImage(model = it, contentDescription = "Puzzle image", modifier = Modifier.fillMaxWidth().padding(16.dp)) }
            Text("Attempts ${state.attempts}/${state.maxAttempts}", Modifier.padding(horizontal = 16.dp))
            state.choices.forEach { choice -> Button(onClick = { onGuess(choice) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) { Text(choice.title) } }
            Button(onClick = onHint, modifier = Modifier.padding(16.dp)) { Text("Hint") }
            state.hint?.let { Text(it, Modifier.padding(16.dp)) }
            state.result?.let { result ->
                Card(Modifier.padding(16.dp)) { Column(Modifier.padding(16.dp)) { Text(result); Button(onClick = { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "I played today's EpisodEra puzzle!" ) }, "Share puzzle")) }) { Text("Share") } } }
            }
            state.signedInStats?.let { Text(it, Modifier.padding(16.dp)) }
        }
    }
}
