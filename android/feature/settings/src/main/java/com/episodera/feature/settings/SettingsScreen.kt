package com.episodera.feature.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.model.SupportedLanguage
import com.episodera.core.model.UserSettings
import com.episodera.core.network.EpisodEraRepository
import com.episodera.core.network.PreferencesStore
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
    private val preferences: PreferencesStore,
) : ViewModel() {
    var language by mutableStateOf("en-US"); private set
    var region by mutableStateOf("US"); private set
    var providers by mutableStateOf(setOf<String>()); private set
    var shareActivity by mutableStateOf(true); private set
    var showImportStatus by mutableStateOf<String?>(null); private set
    init { load() }
    private fun load() = viewModelScope.launch {
        language = preferences.language(); region = preferences.watchRegion() ?: "US"
        runCatching { repository.settings() }.onSuccess { settings ->
            language = if (settings.language == SupportedLanguage.ZH_TW) "zh-TW" else "en-US"
            region = settings.watchRegion; providers = settings.preferredProviderIds.map(Int::toString).toSet()
            shareActivity = settings.shareActivityWithFriends
        }
    }
    fun setLanguage(value: String) = save { language = value; preferences.setLanguage(value) }
    fun setRegion(value: String) = save { region = value; preferences.setWatchRegion(value) }
    fun toggleProvider(value: String) = save { providers = providers.toggle(value) }
    fun setShareActivity(value: Boolean) = save { shareActivity = value }
    private fun save(change: suspend () -> Unit) = viewModelScope.launch {
        change()
        runCatching {
            repository.updateSettings(UserSettings(true, if (language == "zh-TW") SupportedLanguage.ZH_TW else SupportedLanguage.EN_US,
                providers.mapNotNull(String::toIntOrNull), region, true, true, shareActivity, true, true))
        }.onFailure { showImportStatus = it.message ?: "Could not save settings" }
    }
    fun importFile(uri: Uri?) = viewModelScope.launch {
        if (uri == null) return@launch
        runCatching { repository.createImport(sourceHash = uri.toString()).let { repository.runImport(it.import.importId) } }
            .onSuccess { showImportStatus = "Import started." }
            .onFailure { showImportStatus = it.message ?: "Unable to start import" }
    }
    fun export(onReady: (String) -> Unit) = viewModelScope.launch {
        runCatching { Json.encodeToString(repository.export()) }.onSuccess(onReady)
            .onFailure { showImportStatus = it.message ?: "Unable to export data" }
    }
    fun deleteAccount() = viewModelScope.launch {
        runCatching { repository.deleteAccount() }.onSuccess { showImportStatus = "Account deleted." }
            .onFailure { showImportStatus = it.message ?: "Unable to delete account" }
    }
}

private fun Set<String>.toggle(value: String) = if (value in this) this - value else this + value

@Composable
fun SettingsRoute(viewModel: SettingsViewModel = hiltViewModel()) = SettingsScreen(viewModel)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel) {
    val context = LocalContext.current
    var deleteConfirmation by mutableStateOf(false)
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { viewModel.importFile(it) }
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Settings") })
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
            Text("Language")
            Button(onClick = { viewModel.setLanguage(if (viewModel.language == "en-US") "zh-TW" else "en-US") }) { Text(viewModel.language) }
            Text("Watch region", Modifier.padding(top = 16.dp))
            Button(onClick = { viewModel.setRegion(if (viewModel.region == "US") "TW" else "US") }) { Text(viewModel.region) }
            Text("Streaming providers", Modifier.padding(top = 16.dp))
            listOf(8 to "Netflix", 337 to "Disney+", 9 to "Prime Video").forEach { (id, name) ->
                val key = id.toString()
                TextButton(onClick = { viewModel.toggleProvider(key) }) {
                    Checkbox(checked = key in viewModel.providers, onCheckedChange = { viewModel.toggleProvider(key) }); Text(name)
                }
            }
            Text("Privacy & social", Modifier.padding(top = 16.dp))
            TextButton(onClick = { viewModel.setShareActivity(!viewModel.shareActivity) }) {
                Checkbox(checked = viewModel.shareActivity, onCheckedChange = viewModel::setShareActivity); Text("Share activity with friends")
            }
            Text("TV Time import", Modifier.padding(top = 16.dp))
            Button(onClick = { filePicker.launch(arrayOf("application/json", "application/zip")) }) { Text("Choose JSON or ZIP") }
            Text("JSON imports can be staged on device; ZIP extraction is available on the web importer.", Modifier.padding(top = 4.dp))
            viewModel.showImportStatus?.let { Text(it, Modifier.padding(top = 8.dp)) }
            Button(onClick = { viewModel.export { shareExport(context, it) } }, modifier = Modifier.padding(top = 16.dp)) { Text("Export personal data") }
            TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://episodera.web.app/privacy"))) }) { Text("Privacy policy") }
            Text("This product uses the TMDB API but is not endorsed or certified by TMDB.", Modifier.padding(top = 8.dp))
            TextButton(onClick = { deleteConfirmation = true }, modifier = Modifier.padding(top = 16.dp)) { Text("Delete account") }
        }
    }
    if (deleteConfirmation) AlertDialog(
        onDismissRequest = { deleteConfirmation = false },
        title = { Text("Delete account?") },
        text = { Text("This permanently deletes your EpisodEra account and data.") },
        confirmButton = { Button(onClick = { viewModel.deleteAccount(); deleteConfirmation = false }) { Text("Delete") } },
        dismissButton = { TextButton(onClick = { deleteConfirmation = false }) { Text("Cancel") } },
    )
}

private fun shareExport(context: Context, exportJson: String) {
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "application/json"; putExtra(Intent.EXTRA_TEXT, exportJson) }, "Export EpisodEra data"))
}
