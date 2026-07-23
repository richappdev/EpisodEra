package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class LikedItem(val itemId: String, val tmdbId: Int, val mediaType: MediaType, val title: String, val poster: String? = null, val backdrop: String? = null, val likedAt: String? = null)
@Serializable data class LikedResponse(val items: List<LikedItem>, val pageSize: Int, val nextPageToken: String? = null, val hasMore: Boolean)
@Serializable data class AddLikedItemInput(val tmdbId: Int, val mediaType: MediaType, val title: String, val poster: String? = null, val backdrop: String? = null)
