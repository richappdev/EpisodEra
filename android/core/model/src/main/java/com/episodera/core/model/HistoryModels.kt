package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class HistoryEntry(val historyId: String, val tmdbId: Int, val mediaType: MediaType, val title: String, val seasonNumber: Int? = null, val episodeNumber: Int? = null, val episodeTitle: String? = null, val watchedAt: String? = null, val updatedAt: String? = null, val rewatchCount: Int? = null, val genreNames: List<String>? = null, val runtimeMinutes: Int? = null)
@Serializable data class HistoryResponse(val items: List<HistoryEntry>, val pageSize: Int, val nextPageToken: String? = null, val hasMore: Boolean)
@Serializable data class UpdateHistoryInput(val watchedAt: String)
