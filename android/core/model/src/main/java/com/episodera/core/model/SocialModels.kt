package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class FriendStatus { @SerialName("pending_outgoing") PENDING_OUTGOING, @SerialName("pending_incoming") PENDING_INCOMING, @SerialName("accepted") ACCEPTED }
@Serializable data class FriendSummary(val userId: String, val friendCode: String? = null, val displayName: String, val status: FriendStatus, val updatedAt: String? = null)
@Serializable data class FriendsResponse(val friendCode: String, val allowFriendRequests: Boolean, val shareActivityWithFriends: Boolean, val items: List<FriendSummary>)
@Serializable data class ActivityFeedItem(val feedId: String, val friendUserId: String, val friendDisplayName: String, val tmdbId: Int, val mediaType: MediaType, val title: String, val seasonNumber: Int? = null, val episodeNumber: Int? = null, val episodeTitle: String? = null, val watchedAt: String? = null, val spoilerHidden: Boolean)
@Serializable data class CompatibilityResult(val friendUserId: String, val friendDisplayName: String, val score: Double, val sharedGenres: List<String>, val yourTopGenres: List<String>, val theirTopGenres: List<String>)
@Serializable data class ChallengeProgress(val id: String, val title: String, val description: String, val target: Int, val unit: String, val current: Int, val progressPercent: Double, val completed: Boolean, val friendCurrent: Int? = null, val friendProgressPercent: Double? = null)
@Serializable data class DiscussionComment(val commentId: String, val userId: String, val displayName: String, val body: String? = null, val mediaType: MediaType, val tmdbId: Int, val seasonNumber: Int? = null, val episodeNumber: Int? = null, val createdAt: String? = null, val spoilerHidden: Boolean)
@Serializable data class DiscussionListResponse(val items: List<DiscussionComment>)
@Serializable data class FeedResponse(val items: List<ActivityFeedItem>)
@Serializable data class ChallengesResponse(val items: List<ChallengeProgress>)
