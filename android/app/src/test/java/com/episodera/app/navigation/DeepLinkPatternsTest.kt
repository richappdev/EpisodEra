package com.episodera.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepLinkPatternsTest {
    @Test
    fun detailPatternsIncludeLegacyAndBothLocales() {
        val patterns = deepLinkPatterns("tv/{id}/season/{season}")
        assertEquals(3, patterns.size)
        assertTrue(patterns.any { "/en-us/tv/" in it })
        assertTrue(patterns.any { "/zh-tw/tv/" in it })
        assertTrue(patterns.any { it == "https://episodera.web.app/tv/{id}/season/{season}" })
    }
}
