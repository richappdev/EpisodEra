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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.network.EpisodEraRepository
import com.episodera.core.design.R as DR
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class Friend(val id: String, val name: String, val status: String)
data class FeedLine(val friendName: String, val title: String, val episodeTitle: String?, val spoilerHidden: Boolean)
data class Compatibility(val friendName: String, val percent: Int)
data class SocialUiState(val friendCode: String = "", val friends: List<Friend> = emptyList(), val feed: List<FeedLine> = emptyList(), val challenges: List<String> = emptyList(), val compatibility: Compatibility? = null, val loading: Boolean = true, val mutating: Boolean = false, val error: String? = null)

@HiltViewModel
class SocialViewModel @Inject constructor(private val repository: EpisodEraRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(SocialUiState())
    val uiState = _uiState.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch {
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        runCatching {
            val friends = repository.friends()
            val feed = repository.feed().items.map { FeedLine(it.friendDisplayName, it.title, it.episodeTitle, it.spoilerHidden) }
            val challenges = repository.challenges().items.map { "${it.title}: ${it.current}/${it.target} ${it.unit}" }
            SocialUiState(friends.friendCode, friends.items.map { Friend(it.userId, it.displayName, it.status.name.lowercase()) }, feed, challenges, loading = false)
        }.onSuccess { _uiState.value = it }.onFailure { _uiState.value = _uiState.value.copy(loading = false, error = it.message ?: "Unable to load social activity") }
    }
    fun request(code: String) = viewModelScope.launch { if (!code.matches(Regex("[A-Z0-9]{6}"))) { _uiState.value = _uiState.value.copy(error = "Friend codes contain six letters or numbers"); return@launch }; mutate { repository.requestFriend(code) } }
    fun updateFriend(id: String, status: String) = viewModelScope.launch { mutate { repository.updateFriend(id, status) } }
    private suspend fun mutate(action: suspend () -> Any) { _uiState.value = _uiState.value.copy(mutating = true, error = null); runCatching { action() }.onSuccess { refresh() }.onFailure { _uiState.value = _uiState.value.copy(mutating = false, error = it.message) } }
    fun compatibility(friend: Friend) = viewModelScope.launch {
        runCatching { repository.compatibility(friend.id) }.onSuccess {
            _uiState.value = _uiState.value.copy(compatibility = Compatibility(it.friendDisplayName, (it.score * 100).toInt()))
        }
    }
}

@Composable
fun SocialRoute(viewModel: SocialViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    SocialScreen(state, viewModel::request, viewModel::updateFriend, viewModel::compatibility, viewModel::refresh)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialScreen(state: SocialUiState, onRequest: (String) -> Unit, onUpdate: (String, String) -> Unit, onCompare: (Friend) -> Unit, onRetry: () -> Unit) {
    var code by rememberSaveable { mutableStateOf("") }
    val clipboard = LocalContext.current.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(stringResource(DR.string.social)) })
        if (state.loading) Text(stringResource(DR.string.loading_social), Modifier.padding(24.dp))
        state.error?.let { Text(it, Modifier.padding(horizontal = 16.dp)); TextButton(onClick = onRetry) { Text(stringResource(DR.string.retry)) } }
        LazyColumn(Modifier.padding(16.dp)) {
            item {
                Text(stringResource(DR.string.your_friend_code, state.friendCode))
                TextButton(onClick = { clipboard.setPrimaryClip(ClipData.newPlainText("EpisodEra", state.friendCode)) }) { Text(stringResource(DR.string.copy_code)) }
                OutlinedTextField(value = code, onValueChange = { code = it.uppercase().take(6) }, label = { Text(stringResource(DR.string.friend_code)) })
                Button(enabled = code.matches(Regex("[A-Z0-9]{6}")) && !state.mutating, onClick = { onRequest(code.trim()); code = "" }) { Text(stringResource(DR.string.send_request)) }
            }
            item { Text(stringResource(DR.string.friends), Modifier.padding(top = 20.dp)) }
            items(state.friends.size) { i ->
                val friend = state.friends[i]
                Text("${friend.name} · ${stringResource(when (friend.status) { "pending_outgoing" -> DR.string.friend_pending_outgoing; "pending_incoming" -> DR.string.friend_pending_incoming; else -> DR.string.friend_accepted })}")
                if (friend.status == "pending_incoming") { TextButton(onClick = { onUpdate(friend.id, "accepted") }) { Text(stringResource(DR.string.accept)) }; TextButton(onClick = { onUpdate(friend.id, "declined") }) { Text(stringResource(DR.string.decline)) } }
                if (friend.status == "accepted") TextButton(onClick = { onCompare(friend) }) { Text(stringResource(DR.string.compatibility)) }
                TextButton(onClick = { onUpdate(friend.id, "removed") }) { Text(stringResource(DR.string.remove)) }
            }
            state.compatibility?.let { item { Text(stringResource(DR.string.compatibility_result, it.friendName, it.percent), Modifier.padding(top = 12.dp)) } }
            item { Text(stringResource(DR.string.activity_feed), Modifier.padding(top = 20.dp)) }
            items(state.feed.size) { index ->
                val entry = state.feed[index]
                Text(
                    if (entry.spoilerHidden) stringResource(DR.string.feed_hidden, entry.friendName)
                    else stringResource(DR.string.feed_watched, entry.friendName, entry.title) + entry.episodeTitle?.let { " · $it" }.orEmpty(),
                    Modifier.padding(vertical = 4.dp),
                )
            }
            item { Text(stringResource(DR.string.challenges), Modifier.padding(top = 20.dp)) }
            items(state.challenges.size) { Text(state.challenges[it], Modifier.padding(vertical = 4.dp)) }
        }
    }
}
