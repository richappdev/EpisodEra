package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class DiscoveryMood { @SerialName("relaxing") RELAXING, @SerialName("mind-bending") MIND_BENDING, @SerialName("emotional") EMOTIONAL, @SerialName("epic") EPIC, @SerialName("quick-watch") QUICK_WATCH }
@Serializable data class MoodDefinition(val id: DiscoveryMood, val label: String, val genreIds: List<Int>, val maxRuntimeMinutes: Int? = null)
@Serializable data class StreamingProviderOption(val id: Int, val name: String)
@Serializable data class DiscoverySuggestionRail(val id: String, val title: String, val reason: String, val items: List<MediaSummary>)
@Serializable data class DiscoverySuggestionsResponse(val mood: DiscoveryMood? = null, val maxMinutes: Int? = null, val region: String, val providerIds: List<Int>, val rails: List<DiscoverySuggestionRail>, val moods: List<MoodDefinition>, val providers: List<StreamingProviderOption>)
@Serializable data class DiscoveryListResponse(val id: String, val title: String, val reason: String, val page: Int, val totalPages: Int, val totalResults: Int, val results: List<MediaSummary>)
