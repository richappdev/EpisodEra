package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class StatsTitleCount(val tmdbId: Int, val mediaType: MediaType, val title: String, val count: Int)
@Serializable data class StatsGenreCount(val name: String, val count: Int)
@Serializable data class UserStats(val totalWatchedMovies: Int, val totalWatchedEpisodes: Int, val currentlyWatchingCount: Int, val completedShowsCount: Int, val watchlistCount: Int, val likedCount: Int, val progressShowCount: Int, val totalWatchTimeMinutes: Int, val longestStreakDays: Int, val currentStreakDays: Int, val topShows: List<StatsTitleCount>, val topMovies: List<StatsTitleCount>, val topGenres: List<StatsGenreCount>, val mostActiveMonth: String? = null)
@Serializable data class YearRecap(val year: Int, val totalWatchedMovies: Int, val totalWatchedEpisodes: Int, val totalWatchTimeMinutes: Int, val longestStreakDays: Int, val mostActiveMonth: String? = null, val topShow: StatsTitleCount? = null, val topMovie: StatsTitleCount? = null, val topGenre: StatsGenreCount? = null, val newlyDiscovered: List<StatsTitleCount>)
