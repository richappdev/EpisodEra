package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class EpisodeProgress(val episodeKey: String, val seasonNumber: Int, val episodeNumber: Int, val episodeTitle: String, val watched: Boolean, val watchedAt: String? = null, val updatedAt: String? = null)
@Serializable data class ProgressEpisodePointer(val episodeKey: String, val seasonNumber: Int, val episodeNumber: Int, val episodeTitle: String)
@Serializable data class ShowProgressSummary(val showId: String, val tmdbId: Int, val title: String, val poster: String? = null, val totalEpisodes: Int, val watchedEpisodeCount: Int, val progressPercent: Double, val currentSeason: Int? = null, val currentEpisode: Int? = null, val nextEpisode: ProgressEpisodePointer? = null, val updatedAt: String? = null)
@Serializable data class ShowProgress(val showId: String, val tmdbId: Int, val title: String, val poster: String? = null, val totalEpisodes: Int, val watchedEpisodeCount: Int, val progressPercent: Double, val currentSeason: Int? = null, val currentEpisode: Int? = null, val nextEpisode: ProgressEpisodePointer? = null, val updatedAt: String? = null, val episodes: List<EpisodeProgress>)
@Serializable data class ProgressResponse(val progress: ShowProgress? = null)
@Serializable data class ProgressListResponse(val items: List<ShowProgressSummary>, val pageSize: Int, val nextPageToken: String? = null, val hasMore: Boolean)
@Serializable data class MarkEpisodeWatchedInput(val seasonNumber: Int, val episodeNumber: Int)
@Serializable data class BatchEpisodeProgressInput(val watched: Boolean, val episodes: List<MarkEpisodeWatchedInput>)
