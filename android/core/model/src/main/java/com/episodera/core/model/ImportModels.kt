package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class ImportJobSummary(val importId: String, val provider: String, val status: String, val sourceHash: String? = null, val watchlistStaged: Int = 0, val episodesStaged: Int = 0, val watchlistImported: Int = 0, val episodesImported: Int = 0, val episodesSkipped: Int = 0, val episodesFailed: Int = 0, val errorMessage: String? = null, val createdAt: String? = null, val updatedAt: String? = null, val completedAt: String? = null, val stagingClearedAt: String? = null, val stagingDocsDeleted: Int = 0)
@Serializable data class ImportRunResult(val import: ImportJobSummary, val processedEpisodes: Int, val remainingEpisodes: Int, val done: Boolean)
@Serializable data class ImportWatchlistItemInput(val tmdbId: Int, val mediaType: MediaType, val title: String, val poster: String? = null, val backdrop: String? = null, val status: String, val sourceShowId: String? = null)
@Serializable data class ImportEpisodeInput(val tmdbId: Int, val seasonNumber: Int, val episodeNumber: Int, val watchedAt: String? = null, val sourceShowId: String? = null, val sourceEpisodeId: String? = null, val bulkType: String? = null)
@Serializable data class ResolveTvTimeShowInput(val sourceShowId: String, val title: String)
@Serializable data class AcceptedTvTimeShowMapping(val sourceShowId: String, val tmdbId: Int, val title: String, val poster: String? = null, val backdrop: String? = null, val confidence: Double, val matchMethod: String)
@Serializable data class TvTimeMappingCandidate(val tmdbId: Int, val title: String, val poster: String? = null, val backdrop: String? = null, val year: String? = null)
@Serializable data class SkippedTvTimeShowMapping(val sourceShowId: String, val title: String, val reason: String, val confidence: Double? = null, val notes: String? = null, val candidates: List<TvTimeMappingCandidate>)
@Serializable data class ResolveTvTimeShowsResponse(val accepted: List<AcceptedTvTimeShowMapping>, val skipped: List<SkippedTvTimeShowMapping>)
@Serializable data class MediaMapping(val provider: String, val mediaType: MediaType, val externalId: String, val tmdbId: Int, val title: String? = null, val updatedBy: String? = null, val updatedAt: String? = null)
@Serializable data class ImportSummaryEnvelope(val import: ImportJobSummary)
@Serializable data class MappingEnvelope(val mapping: MediaMapping)
