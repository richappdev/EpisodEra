package com.episodera.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class FranchiseOrder { @SerialName("release") RELEASE, @SerialName("chronological") CHRONOLOGICAL }
@Serializable data class FranchisePhase(val id: String, val name: String)
@Serializable data class FranchiseTitle(val tmdbId: Int, val mediaType: MediaType, val title: String, val phaseId: String, val releaseOrder: Int, val chronologicalOrder: Int, val runtimeMinutes: Int? = null, val providerIds: List<Int>? = null)
@Serializable data class FranchiseSummary(val slug: String, val name: String, val description: String, val titleCount: Int, val phaseCount: Int)
@Serializable data class FranchiseCatalog(val slug: String, val name: String, val description: String, val phases: List<FranchisePhase>, val titles: List<FranchiseTitle>)
@Serializable data class FranchiseTitleProgress(val tmdbId: Int, val mediaType: MediaType, val title: String, val phaseId: String, val phaseName: String, val releaseOrder: Int, val chronologicalOrder: Int, val runtimeMinutes: Int? = null, val status: String, val progressPercent: Double)
@Serializable data class FranchisePhaseProgress(val id: String, val name: String, val totalTitles: Int, val watchedTitles: Int, val progressPercent: Double)
@Serializable data class FranchiseProgress(val slug: String, val name: String, val description: String, val order: FranchiseOrder, val totalTitles: Int, val watchedTitles: Int, val inProgressTitles: Int, val progressPercent: Double, val phases: List<FranchisePhaseProgress>, val titles: List<FranchiseTitleProgress>, val recommendedNext: FranchiseTitleProgress? = null)
@Serializable data class FranchiseListResponse(val items: List<FranchiseSummary>)
