package com.episodera.core.model

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsUpdateInputTest {
    private val json = Json { explicitNulls = false; encodeDefaults = false }

    @Test
    fun changingLanguageDoesNotSerializeOtherSettings() {
        val encoded = json.encodeToString(SettingsUpdateInput(language = SupportedLanguage.ZH_TW))
        assertEquals("{\"language\":\"zh-TW\"}", encoded)
        assertFalse(encoded.contains("achievementsEnabled"))
        assertFalse(encoded.contains("autoMarkPreviousEpisodesWatched"))
    }

    @Test
    fun providerPatchPreservesTheRequestedList() {
        val encoded = json.encodeToString(SettingsUpdateInput(preferredProviderIds = listOf(8, 337)))
        assertTrue(encoded.contains("\"preferredProviderIds\":[8,337]"))
    }

    @Test
    fun paginationCarriesOpaquePageToken() {
        val params = PaginationParams(pageSize = 50, pageToken = "opaque/token+value")
        assertEquals(50, params.pageSize)
        assertEquals("opaque/token+value", params.pageToken)
    }
}
