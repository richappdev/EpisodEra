package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class SupportedLanguage { @SerialName("en-US") EN_US, @SerialName("zh-TW") ZH_TW }
@Serializable data class UserSettings(val autoMarkPreviousEpisodesWatched: Boolean, val language: SupportedLanguage, val preferredProviderIds: List<Int>, val watchRegion: String, val achievementsEnabled: Boolean, val showAchievementsOnProfile: Boolean, val shareActivityWithFriends: Boolean, val allowFriendRequests: Boolean, val hideSpoilersUntilWatched: Boolean, val updatedAt: String? = null)
@Serializable data class SettingsUpdateInput(
    val autoMarkPreviousEpisodesWatched: Boolean? = null,
    val language: SupportedLanguage? = null,
    val preferredProviderIds: List<Int>? = null,
    val watchRegion: String? = null,
    val achievementsEnabled: Boolean? = null,
    val showAchievementsOnProfile: Boolean? = null,
    val shareActivityWithFriends: Boolean? = null,
    val allowFriendRequests: Boolean? = null,
    val hideSpoilersUntilWatched: Boolean? = null,
)
@Serializable data class CommonStreamingProvider(val id: Int, val name: String)
