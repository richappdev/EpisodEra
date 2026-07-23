package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class UserDataExportCounts(val history: Int, val progressShows: Int, val progressEpisodes: Int, val watchlist: Int)
@Serializable data class UserDataExportManifest(val schemaVersion: Int, val exportedAt: String, val userId: String, val counts: UserDataExportCounts)
@Serializable data class UserDataExport(val manifest: UserDataExportManifest, val history: List<HistoryEntry>, val progress: List<ShowProgress>, val watchlist: List<WatchlistItem>)
