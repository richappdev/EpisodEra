package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class SupportedLanguage { @SerialName("en-US") EN_US, @SerialName("zh-TW") ZH_TW }
@Serializable data class UserSettings(val autoMarkPreviousEpisodesWatched: Boolean, val language: SupportedLanguage, val preferredProviderIds: List<Int>, val watchRegion: String, val achievementsEnabled: Boolean, val showAchievementsOnProfile: Boolean, val shareActivityWithFriends: Boolean, val allowFriendRequests: Boolean, val hideSpoilersUntilWatched: Boolean, val updatedAt: String? = null)
@Serializable data class CommonStreamingProvider(val id: Int, val name: String)
