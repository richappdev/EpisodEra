package com.episodera.core.model

import kotlinx.serialization.Serializable

@Serializable data class UserProfile(val firstName: String, val lastName: String, val email: String? = null, val displayName: String? = null, val photoURL: String? = null, val bio: String? = null, val country: String? = null, val timezone: String? = null, val friendCode: String? = null, val createdAt: String? = null, val updatedAt: String? = null)
@Serializable data class ProfileResponse(val profile: UserProfile? = null)
@Serializable data class UpdateUserProfileInput(val firstName: String? = null, val lastName: String? = null, val displayName: String? = null, val photoURL: String? = null, val bio: String? = null, val country: String? = null, val timezone: String? = null)
