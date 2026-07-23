package com.episodera.app.navigation

object AppDestinations {
    const val HOME = "home"
    const val SEARCH = "search"
    const val WATCHLIST = "watchlist"
    const val LIKES = "likes"
    const val TIMELINE = "timeline"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"
    const val SOCIAL = "social"
    const val PUZZLE = "puzzle"
    const val FRANCHISES = "franchises"
    const val AUTH = "auth"
    const val BLOCKED = "blocked"
    const val DISCOVERY_LIST = "list/{listId}"
    const val FRANCHISE_DETAIL = "franchises/{slug}"
    const val MOVIE_DETAIL = "movie/{id}"
    const val TV_DETAIL = "tv/{id}"

    fun discoveryList(listId: String) = "list/$listId"
    fun franchiseDetail(slug: String) = "franchises/$slug"
    fun movieDetail(id: Int) = "movie/$id"
    fun tvDetail(id: Int) = "tv/$id"
}
