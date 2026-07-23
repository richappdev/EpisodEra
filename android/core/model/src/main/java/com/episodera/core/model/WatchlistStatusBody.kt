package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable
data class UpdateWatchlistStatusBody(val status: WatchlistStatus)
