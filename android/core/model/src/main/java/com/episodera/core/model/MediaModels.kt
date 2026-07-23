package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class MediaType {
    @SerialName("movie") MOVIE,
    @SerialName("tv") TV;

    val wireValue: String get() = if (this == MOVIE) "movie" else "tv"
}
@Serializable data class ImageSet(val poster: String? = null, val backdrop: String? = null)
@Serializable data class MediaSummary(val id: Int, val mediaType: MediaType, val title: String, val overview: String, val releaseDate: String? = null, val voteAverage: Double, val popularity: Double, val images: ImageSet)
@Serializable data class Genre(val id: Int, val name: String)
@Serializable data class MediaDetail(val id: Int, val mediaType: MediaType, val title: String, val overview: String, val releaseDate: String? = null, val voteAverage: Double, val popularity: Double, val images: ImageSet, val genres: List<Genre>, val runtimeMinutes: Int? = null, val status: String? = null, val originalLanguage: String? = null, val homepage: String? = null, val totalEpisodes: Int? = null, val seasons: List<TvSeasonSummary>? = null)
@Serializable data class EpisodeSummary(val id: Int, val episodeKey: String, val seasonNumber: Int, val episodeNumber: Int, val title: String, val overview: String, val airDate: String? = null, val runtimeMinutes: Int? = null, val still: String? = null, val voteAverage: Double)
@Serializable data class TvSeasonDetail(val id: Int, val tvId: Int, val seasonNumber: Int, val title: String, val overview: String, val airDate: String? = null, val poster: String? = null, val episodeCount: Int, val episodes: List<EpisodeSummary>)
@Serializable data class TvSeasonSummary(val id: Int, val seasonNumber: Int, val title: String, val episodeCount: Int, val airDate: String? = null, val poster: String? = null)
@Serializable data class PagedResult<T>(val page: Int, val totalPages: Int, val totalResults: Int, val results: List<T>)
@Serializable data class DiscoveryResponse(val movies: PagedResult<MediaSummary>, val tv: PagedResult<MediaSummary>)
@Serializable data class HealthResponse(val ok: Boolean)
