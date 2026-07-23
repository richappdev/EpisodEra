package com.episodera.feature.social

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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

data class Friend(val id: String, val name: String, val status: String)
data class SocialUiState(val friendCode: String = "", val friends: List<Friend> = emptyList(), val feed: List<String> = emptyList(), val challenges: List<String> = emptyList(), val compatibility: String? = null)

@HiltViewModel
class SocialViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(SocialUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }
    private fun refresh() = viewModelScope.launch {
        runCatching {
            val friends = repository.friends()
            val feed = repository.feed().items.map { "${it.friendDisplayName} watched ${it.title}" }
            val challenges = repository.challenges().items.map { "${it.title}: ${it.current}/${it.target} ${it.unit}" }
            SocialUiState(friends.friendCode, friends.items.map { Friend(it.userId, it.displayName, it.status.name.lowercase()) }, feed, challenges)
        }.onSuccess { _uiState.value = it }
    }
    fun request(code: String) = viewModelScope.launch { runCatching { repository.requestFriend(code) }.onSuccess { refresh() } }
    fun updateFriend(id: String, status: String) = viewModelScope.launch { runCatching { repository.updateFriend(id, status) }.onSuccess { refresh() } }
    fun compatibility(friend: Friend) = viewModelScope.launch {
        runCatching { repository.compatibility(friend.id) }.onSuccess {
            _uiState.value = _uiState.value.copy(compatibility = "Compatibility with ${it.friendDisplayName}: ${(it.score * 100).toInt()}%")
        }
    }
}

@Composable
fun SocialRoute(viewModel: SocialViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    SocialScreen(state, viewModel::request, viewModel::updateFriend, viewModel::compatibility)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialScreen(state: SocialUiState, onRequest: (String) -> Unit, onUpdate: (String, String) -> Unit, onCompare: (Friend) -> Unit) {
    var code by mutableStateOf("")
    val clipboard = LocalContext.current.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Social") })
        LazyColumn(Modifier.padding(16.dp)) {
            item {
                Text("Your friend code: ${state.friendCode}")
                TextButton(onClick = { clipboard.setPrimaryClip(ClipData.newPlainText("EpisodEra friend code", state.friendCode)) }) { Text("Copy code") }
                OutlinedTextField(value = code, onValueChange = { code = it.uppercase() }, label = { Text("Friend code") })
                Button(onClick = { onRequest(code.trim()); code = "" }) { Text("Send request") }
            }
            item { Text("Friends", Modifier.padding(top = 20.dp)) }
            items(state.friends.size) { i ->
                val friend = state.friends[i]
                Text("${friend.name} · ${friend.status}")
                if (friend.status == "pending_incoming") { TextButton(onClick = { onUpdate(friend.id, "accepted") }) { Text("Accept") }; TextButton(onClick = { onUpdate(friend.id, "declined") }) { Text("Decline") } }
                if (friend.status == "accepted") TextButton(onClick = { onCompare(friend) }) { Text("Compatibility") }
                TextButton(onClick = { onUpdate(friend.id, "removed") }) { Text("Remove") }
            }
            state.compatibility?.let { item { Text(it, Modifier.padding(top = 12.dp)) } }
            item { Text("Activity feed", Modifier.padding(top = 20.dp)) }
            items(state.feed.size) { Text(state.feed[it], Modifier.padding(vertical = 4.dp)) }
            item { Text("Challenges", Modifier.padding(top = 20.dp)) }
            items(state.challenges.size) { Text(state.challenges[it], Modifier.padding(vertical = 4.dp)) }
        }
    }
}
