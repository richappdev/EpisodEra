package com.episodera.feature.timeline

import com.episodera.core.model.HistoryEntry
import com.episodera.core.model.MediaType
import org.junit.Assert.assertEquals
import org.junit.Test

class TimelineFilterTest {
    private val entries = listOf(
        HistoryEntry("movie", 1, MediaType.MOVIE, "Arrival", rewatchCount = 2),
        HistoryEntry("episode", 2, MediaType.TV, "The Bear", episodeTitle = "Review", rewatchCount = 0),
    )

    @Test fun searchesEpisodeTitles() {
        assertEquals(listOf("episode"), filterTimeline(entries, "review", TimelineMediaFilter.ALL, false).map { it.historyId })
    }

    @Test fun combinesMediaAndRewatchFilters() {
        assertEquals(listOf("movie"), filterTimeline(entries, "", TimelineMediaFilter.MOVIE, true).map { it.historyId })
    }
}
