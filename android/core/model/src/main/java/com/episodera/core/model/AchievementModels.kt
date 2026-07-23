package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class AchievementProgress(val id: String, val title: String, val description: String, val category: String, val unlocked: Boolean, val unlockedAt: String? = null, val current: Int, val target: Int, val progressPercent: Double)
@Serializable data class AchievementsResponse(val enabled: Boolean, val showOnProfile: Boolean, val items: List<AchievementProgress>, val unlockedCount: Int)
