package com.episodera.feature.settings

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.episodera.core.model.*
import com.episodera.core.design.R as DR
import com.episodera.core.network.EpisodEraRepository
import com.episodera.core.network.PreferencesStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

data class SettingsUiState(
    val settings: UserSettings? = null,
    val providers: List<StreamingProviderOption> = emptyList(),
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
    private val preferences: PreferencesStore,
) : ViewModel() {
    var state by mutableStateOf(SettingsUiState()); private set

    init { load() }

    fun load() = viewModelScope.launch {
        state = state.copy(loading = true, error = null)
        val settingsResult = runCatching { repository.settings() }
        val discoveryResult = runCatching { repository.discoverySuggestions() }
        settingsResult.onSuccess { loaded ->
            preferences.setLanguage(if (loaded.language == SupportedLanguage.ZH_TW) "zh-TW" else "en-US")
            preferences.setWatchRegion(loaded.watchRegion)
            state = SettingsUiState(
                settings = loaded,
                providers = discoveryResult.getOrNull()?.providers.orEmpty(),
                loading = false,
                error = discoveryResult.exceptionOrNull()?.message,
            )
        }.onFailure { state = state.copy(loading = false, error = it.message ?: "Unable to load settings") }
    }

    fun update(input: SettingsUpdateInput, onSuccess: (() -> Unit)? = null) = viewModelScope.launch {
        state = state.copy(saving = true, error = null)
        runCatching { repository.updateSettings(input) }
            .onSuccess { updated ->
                input.language?.let { preferences.setLanguage(if (it == SupportedLanguage.ZH_TW) "zh-TW" else "en-US") }
                input.watchRegion?.let { preferences.setWatchRegion(it) }
                state = state.copy(settings = updated, saving = false)
                onSuccess?.invoke()
            }
            .onFailure { state = state.copy(saving = false, error = it.message ?: "Could not save settings") }
    }

    fun export(onReady: (String) -> Unit) = viewModelScope.launch {
        state = state.copy(saving = true, error = null)
        runCatching { Json.encodeToString(repository.export()) }
            .onSuccess { state = state.copy(saving = false); onReady(it) }
            .onFailure { state = state.copy(saving = false, error = it.message ?: "Unable to export data") }
    }

    fun deleteAccount(onDeleted: () -> Unit) = viewModelScope.launch {
        state = state.copy(saving = true, error = null)
        runCatching { repository.deleteAccount() }
            .onSuccess { state = state.copy(saving = false); onDeleted() }
            .onFailure { state = state.copy(saving = false, error = it.message ?: "Unable to delete account") }
    }
}

@Composable
fun SettingsRoute(
    onLanguageApplied: (SupportedLanguage) -> Unit,
    onOpenPrivacy: () -> Unit,
    onDeleted: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) = SettingsScreen(viewModel, onLanguageApplied, onOpenPrivacy, onDeleted)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onLanguageApplied: (SupportedLanguage) -> Unit,
    onOpenPrivacy: () -> Unit,
    onDeleted: () -> Unit,
) {
    val state = viewModel.state
    val settings = state.settings
    val context = LocalContext.current
    val exportTitle = stringResource(DR.string.export_data)
    var deleteDialog by rememberSaveable { mutableStateOf(false) }
    var deleteText by rememberSaveable { mutableStateOf("") }
    var regionDraft by rememberSaveable(settings?.watchRegion) { mutableStateOf(settings?.watchRegion.orEmpty()) }

    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text(stringResource(DR.string.settings)) })
        when {
            state.loading -> CircularProgressIndicator(Modifier.padding(24.dp))
            settings == null -> Column(Modifier.padding(24.dp)) {
                Text(state.error ?: stringResource(DR.string.unable_load_settings))
                Button(onClick = viewModel::load) { Text(stringResource(DR.string.retry)) }
            }
            else -> Column(
                Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(stringResource(DR.string.language))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SupportedLanguage.entries.forEach { language ->
                        Button(
                            enabled = !state.saving && language != settings.language,
                            onClick = { viewModel.update(SettingsUpdateInput(language = language)) { onLanguageApplied(language) } },
                        ) { Text(if (language == SupportedLanguage.ZH_TW) "繁體中文" else "English") }
                    }
                }
                Text(stringResource(DR.string.watch_region))
                OutlinedTextField(
                    value = regionDraft,
                    onValueChange = { regionDraft = it.uppercase().take(2) },
                    label = { Text(stringResource(DR.string.country_code)) },
                    isError = regionDraft.length != 2,
                    singleLine = true,
                )
                Button(
                    enabled = !state.saving && regionDraft.matches(Regex("[A-Z]{2}")) && regionDraft != settings.watchRegion,
                    onClick = { viewModel.update(SettingsUpdateInput(watchRegion = regionDraft)) },
                ) { Text(stringResource(DR.string.save_region)) }

                Text(stringResource(DR.string.streaming_providers))
                state.providers.forEach { provider ->
                    val selected = provider.id in settings.preferredProviderIds
                    Row(Modifier.fillMaxWidth()) {
                        Checkbox(
                            checked = selected,
                            enabled = !state.saving,
                            onCheckedChange = {
                                val next = if (selected) settings.preferredProviderIds - provider.id else settings.preferredProviderIds + provider.id
                                viewModel.update(SettingsUpdateInput(preferredProviderIds = next.distinct()))
                            },
                        )
                        Text(provider.name, Modifier.padding(top = 12.dp))
                    }
                }
                SettingSwitch(stringResource(DR.string.auto_mark_previous), settings.autoMarkPreviousEpisodesWatched, state.saving) { viewModel.update(SettingsUpdateInput(autoMarkPreviousEpisodesWatched = it)) }
                SettingSwitch(stringResource(DR.string.enable_achievements), settings.achievementsEnabled, state.saving) { viewModel.update(SettingsUpdateInput(achievementsEnabled = it)) }
                SettingSwitch(stringResource(DR.string.show_achievements), settings.showAchievementsOnProfile, state.saving || !settings.achievementsEnabled) { viewModel.update(SettingsUpdateInput(showAchievementsOnProfile = it)) }
                SettingSwitch(stringResource(DR.string.share_activity), settings.shareActivityWithFriends, state.saving) { viewModel.update(SettingsUpdateInput(shareActivityWithFriends = it)) }
                SettingSwitch(stringResource(DR.string.allow_friend_requests), settings.allowFriendRequests, state.saving) { viewModel.update(SettingsUpdateInput(allowFriendRequests = it)) }
                SettingSwitch(stringResource(DR.string.hide_spoilers), settings.hideSpoilersUntilWatched, state.saving) { viewModel.update(SettingsUpdateInput(hideSpoilersUntilWatched = it)) }

                Button(onClick = { viewModel.export { shareExport(context, it, exportTitle) } }, enabled = !state.saving) { Text(exportTitle) }
                TextButton(onClick = onOpenPrivacy) { Text(stringResource(DR.string.privacy_policy)) }
                Text(stringResource(DR.string.tmdb_notice))
                Text(stringResource(DR.string.tvtime_web_only))
                TextButton(onClick = { deleteDialog = true }, enabled = !state.saving) { Text(stringResource(DR.string.delete_account)) }
                if (state.saving) Text(stringResource(DR.string.saving))
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        }
    }

    if (deleteDialog) AlertDialog(
        onDismissRequest = { if (!state.saving) deleteDialog = false },
        title = { Text(stringResource(DR.string.delete_account_title)) },
        text = {
            Column {
                Text(stringResource(DR.string.delete_account_body))
                OutlinedTextField(deleteText, { deleteText = it }, singleLine = true)
            }
        },
        confirmButton = {
            Button(enabled = deleteText == "DELETE" && !state.saving, onClick = { viewModel.deleteAccount(onDeleted) }) { Text(stringResource(DR.string.delete)) }
        },
        dismissButton = { TextButton(onClick = { deleteDialog = false }) { Text(stringResource(DR.string.cancel)) } },
    )
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, disabled: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, Modifier.weight(1f).padding(top = 12.dp))
        Switch(checked = checked, onCheckedChange = onChange, enabled = !disabled)
    }
}

private fun shareExport(context: Context, exportJson: String, chooserTitle: String) {
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
        type = "application/json"
        putExtra(Intent.EXTRA_TEXT, exportJson)
    }, chooserTitle))
}
