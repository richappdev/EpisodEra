package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class WatchlistStatus { @SerialName("planned") PLANNED, @SerialName("watching") WATCHING, @SerialName("completed") COMPLETED, @SerialName("dropped") DROPPED, @SerialName("unwatched") UNWATCHED, @SerialName("watched") WATCHED }
@Serializable data class WatchlistItem(val itemId: String, val tmdbId: Int, val mediaType: MediaType, val title: String, val poster: String? = null, val backdrop: String? = null, val status: WatchlistStatus, val addedAt: String? = null, val updatedAt: String? = null)
@Serializable data class WatchlistResponse(val items: List<WatchlistItem>, val pageSize: Int, val nextPageToken: String? = null, val hasMore: Boolean)
@Serializable data class AddWatchlistItemInput(val tmdbId: Int, val mediaType: MediaType, val title: String, val poster: String? = null, val backdrop: String? = null, val status: WatchlistStatus? = null)
