package com.episodera.core.model

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class MediaTypeSerializationTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun mediaTypeUsesWireValues() {
        assertEquals("movie", MediaType.MOVIE.wireValue)
        assertEquals("tv", MediaType.TV.wireValue)
        assertEquals("\"movie\"", json.encodeToString(MediaType.MOVIE))
        assertEquals("\"tv\"", json.encodeToString(MediaType.TV))
    }

    @Test
    fun healthResponseRoundTrip() {
        val encoded = json.encodeToString(HealthResponse(ok = true))
        val decoded = json.decodeFromString<HealthResponse>(encoded)
        assertEquals(true, decoded.ok)
    }
}
