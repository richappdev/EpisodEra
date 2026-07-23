package com.episodera.core.network

import kotlinx.serialization.Serializable

@Serializable data class ApiErrorBody(val error: ApiError? = null)
@Serializable data class ApiError(val message: String? = null)
