package com.episodera.core.network

import com.episodera.core.model.*
import retrofit2.Response
import retrofit2.http.*

interface EpisodEraApi {
    @GET("health") suspend fun health(): HealthResponse
    @GET("trending") suspend fun trending(@Query("page") page: Int? = null, @Query("pageSize") pageSize: Int? = null): DiscoveryResponse
    @GET("trending/movie") suspend fun trendingMovies(@Query("page") page: Int? = null, @Query("pageSize") pageSize: Int? = null): PagedResult<MediaSummary>
    @GET("trending/tv") suspend fun trendingTv(@Query("page") page: Int? = null, @Query("pageSize") pageSize: Int? = null): PagedResult<MediaSummary>
    @GET("search") suspend fun search(@Query("q") query: String, @Query("page") page: Int? = null, @Query("pageSize") pageSize: Int? = null): DiscoveryResponse
    @GET("{type}/{id}") suspend fun detail(@Path("type") type: String, @Path("id") id: Int): MediaDetail
    @GET("tv/{id}/season/{season}") suspend fun tvSeason(@Path("id") id: Int, @Path("season") season: Int): TvSeasonDetail
    @GET("discussions/{type}/{id}") suspend fun discussions(@Path("type") type: String, @Path("id") id: Int): DiscussionListResponse
    @POST("discussions/{type}/{id}") suspend fun createDiscussion(@Path("type") type: String, @Path("id") id: Int, @Body input: CreateDiscussionInput): DiscussionComment
    @GET("franchises") suspend fun franchises(): FranchiseListResponse
    @GET("franchises/{slug}") suspend fun franchise(@Path("slug") slug: String): FranchiseCatalog
    @GET("discover/suggestions") suspend fun discoverySuggestions(@Query("mood") mood: String? = null, @Query("maxMinutes") maxMinutes: Int? = null, @Query("providers") providers: String? = null, @Query("region") region: String? = null): DiscoverySuggestionsResponse
    @GET("discover/lists/{listId}") suspend fun discoveryList(@Path("listId") listId: String, @Query("page") page: Int? = null, @Query("maxMinutes") maxMinutes: Int? = null, @Query("providers") providers: String? = null, @Query("region") region: String? = null): DiscoveryListResponse
    @GET("watchlist") suspend fun watchlist(@Query("pageSize") pageSize: Int? = null, @Query("pageToken") pageToken: String? = null): WatchlistResponse
    @POST("watchlist") suspend fun addWatchlist(@Body input: AddWatchlistItemInput): WatchlistItem
    @PATCH("watchlist/{itemId}/status") suspend fun updateWatchlist(@Path("itemId") itemId: String, @Body body: UpdateWatchlistStatusBody): WatchlistItem
    @DELETE("watchlist/{itemId}") suspend fun removeWatchlist(@Path("itemId") itemId: String): Response<Unit>
    @GET("likes") suspend fun likes(@Query("pageSize") pageSize: Int? = null, @Query("pageToken") pageToken: String? = null): LikedResponse
    @POST("likes") suspend fun addLike(@Body input: AddLikedItemInput): LikedItem
    @DELETE("likes/{itemId}") suspend fun removeLike(@Path("itemId") itemId: String): Response<Unit>
    @GET("progress") suspend fun progress(@Query("pageSize") pageSize: Int? = null, @Query("pageToken") pageToken: String? = null): ProgressListResponse
    @GET("progress/{showId}") suspend fun getProgress(@Path("showId") showId: Int): ProgressResponse
    @POST("progress/{showId}/episode") suspend fun markEpisode(@Path("showId") showId: Int, @Body input: MarkEpisodeWatchedInput): ShowProgress
    @POST("progress/{showId}/episodes/batch") suspend fun batchEpisodes(@Path("showId") showId: Int, @Body input: BatchEpisodeProgressInput): ShowProgress
    @DELETE("progress/{showId}/episode/{episodeKey}") suspend fun unmarkEpisode(@Path("showId") showId: Int, @Path("episodeKey") episodeKey: String): ProgressResponse
    @GET("me/profile") suspend fun profile(): ProfileResponse
    @PATCH("me/profile") suspend fun updateProfile(@Body input: UpdateUserProfileInput): UserProfile
    @GET("me/settings") suspend fun settings(): UserSettings
    @PATCH("me/settings") suspend fun updateSettings(@Body settings: UserSettings): UserSettings
    @GET("me/stats") suspend fun stats(): UserStats
    @GET("me/recap") suspend fun recap(@Query("year") year: Int? = null): YearRecap
    @GET("me/history") suspend fun history(@Query("pageSize") pageSize: Int? = null, @Query("pageToken") pageToken: String? = null): HistoryResponse
    @PATCH("me/history/{historyId}") suspend fun updateHistory(@Path("historyId") historyId: String, @Body input: UpdateHistoryInput): HistoryEntry
    @DELETE("me/history/{historyId}") suspend fun deleteHistory(@Path("historyId") historyId: String): Response<Unit>
    @GET("me/achievements") suspend fun achievements(): AchievementsResponse
    @GET("me/friends") suspend fun friends(): FriendsResponse
    @POST("me/friends/request") suspend fun requestFriend(@Body body: Map<String, String>): FriendsResponse
    @PATCH("me/friends/{userId}") suspend fun updateFriend(@Path("userId") userId: String, @Body body: Map<String, String>): FriendsResponse
    @GET("me/feed") suspend fun feed(): FeedResponse
    @GET("me/friends/{userId}/compatibility") suspend fun compatibility(@Path("userId") userId: String): CompatibilityResult
    @GET("me/challenges") suspend fun challenges(@Query("friendUserId") friendUserId: String? = null): ChallengesResponse
    @GET("me/franchises/{slug}/progress") suspend fun franchiseProgress(@Path("slug") slug: String, @Query("order") order: FranchiseOrder = FranchiseOrder.RELEASE): FranchiseProgress
    @GET("me/export") suspend fun export(): UserDataExport
    @DELETE("me/account") suspend fun deleteAccount(): Response<Unit>
    @POST("me/imports/resolve-tv-time-shows") suspend fun resolveTvTime(@Body body: Map<String, @JvmSuppressWildcards List<ResolveTvTimeShowInput>>): ResolveTvTimeShowsResponse
    @PUT("me/imports/media-mappings") suspend fun upsertMapping(@Body mapping: MediaMapping): MappingEnvelope
    @POST("me/imports") suspend fun createImport(@Body body: Map<String, @JvmSuppressWildcards Any?>): ImportSummaryEnvelope
    @GET("me/imports/{id}") suspend fun getImport(@Path("id") id: String): ImportSummaryEnvelope
    @POST("me/imports/{id}/watchlist") suspend fun stageWatchlist(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards List<ImportWatchlistItemInput>>): ImportSummaryEnvelope
    @POST("me/imports/{id}/episodes") suspend fun stageEpisodes(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards List<ImportEpisodeInput>>): ImportSummaryEnvelope
    @POST("me/imports/{id}/commit") suspend fun commitImport(@Path("id") id: String): ImportSummaryEnvelope
    @POST("me/imports/{id}/run") suspend fun runImport(@Path("id") id: String, @Body body: Map<String, Int>): ImportRunResult
    @GET("puzzles/today") suspend fun dailyPuzzle(): DailyPuzzlePayload
    @POST("puzzles/{id}/guess") suspend fun guessPuzzle(@Path("id") id: String, @Body request: GuessRequest): GuessResponse
    @GET("puzzles/stats") suspend fun puzzleStats(): UserGameStats
}
