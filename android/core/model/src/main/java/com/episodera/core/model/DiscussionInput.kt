package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable
data class CreateDiscussionInput(
    val body: String,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
)
