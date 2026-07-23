package com.episodera.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val displayName: String = "",
    val stats: Map<String, String> = emptyMap(),
    val yearRecap: String? = null,
    val achievements: List<String> = emptyList(),
    val recentHistory: List<String> = emptyList(),
    val loading: Boolean = true,
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
        runCatching {
            val profile = repository.profile().profile
            val stats = repository.stats()
            val recap = repository.recap()
            val achievements = repository.achievements()
            val history = repository.history()
            ProfileUiState(
                displayName = profile?.displayName ?: listOfNotNull(profile?.firstName, profile?.lastName).joinToString(" "),
                stats = mapOf("Movies" to stats.totalWatchedMovies.toString(), "Episodes" to stats.totalWatchedEpisodes.toString(), "Streak" to "${stats.currentStreakDays}d"),
                yearRecap = "${recap.year}: ${recap.totalWatchedMovies} films, ${recap.totalWatchedEpisodes} episodes",
                achievements = achievements.items.filter { it.unlocked }.map { it.title },
                recentHistory = history.items.map { it.title },
                loading = false,
            )
        }.onSuccess { _uiState.value = it }.onFailure { _uiState.value = ProfileUiState(loading = false) }
    }
    fun signOut() = auth.signOut()
}

@Composable
fun ProfileRoute(onSignOut: () -> Unit, viewModel: ProfileViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    ProfileScreen(state) { viewModel.signOut(); onSignOut() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(state: ProfileUiState, onSignOut: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(if (state.displayName.isBlank()) "Profile" else state.displayName) })
        if (state.loading) Text("Loading profile…", Modifier.padding(24.dp)) else LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    state.stats.forEach { (name, value) -> Column { Text(value); Text(name) } }
                }
            }
            state.yearRecap?.let { recap -> item { Card(Modifier.padding(horizontal = 16.dp)) { Column(Modifier.padding(16.dp)) { Text("Year Recap"); Text(recap) } } } }
            item {
                Card(Modifier.padding(horizontal = 16.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Achievements")
                        if (state.achievements.isEmpty()) Text("Keep watching to unlock achievements.")
                        state.achievements.forEach { Text("• $it") }
                    }
                }
            }
            item {
                Card(Modifier.padding(horizontal = 16.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Recently watched")
                        state.recentHistory.take(5).forEach { Text(it) }
                    }
                }
            }
            item { TextButton(onClick = onSignOut, modifier = Modifier.padding(16.dp)) { Text("Sign out") } }
        }
    }
}
