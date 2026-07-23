package com.episodera.core.network

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.episodEraPreferences by preferencesDataStore("episodera_preferences")

@Singleton
class PreferencesStore @Inject constructor(@ApplicationContext private val context: Context) {
    private val languageKey = stringPreferencesKey("language")
    private val watchRegionKey = stringPreferencesKey("watch_region")
    private val playerIdKey = stringPreferencesKey("player_id")

    fun language(): String = runBlocking { context.episodEraPreferences.data.first()[languageKey] ?: "en-US" }
    fun watchRegion(): String? = runBlocking { context.episodEraPreferences.data.first()[watchRegionKey] }
    fun playerId(): String = runBlocking {
        val preferences = context.episodEraPreferences.data.first()
        preferences[playerIdKey] ?: UUID.randomUUID().toString().also { id ->
            context.episodEraPreferences.edit { it[playerIdKey] = id }
        }
    }

    suspend fun setLanguage(value: String) = context.episodEraPreferences.edit { it[languageKey] = value }
    suspend fun setWatchRegion(value: String) = context.episodEraPreferences.edit { it[watchRegionKey] = value }
}
