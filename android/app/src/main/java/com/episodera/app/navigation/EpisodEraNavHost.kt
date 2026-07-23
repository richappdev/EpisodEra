package com.episodera.app.navigation

import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import coil.compose.AsyncImage
import com.episodera.app.SiteAccessViewModel
import com.episodera.core.model.MediaSummary
import com.episodera.core.network.EpisodEraRepository
import com.episodera.feature.auth.AuthRoute
import com.episodera.feature.detail.MovieDetailRoute
import com.episodera.feature.detail.TvDetailRoute
import com.episodera.feature.franchises.FranchisesRoute
import com.episodera.feature.home.HomeRoute
import com.episodera.feature.likes.LikesRoute
import com.episodera.feature.profile.ProfileRoute
import com.episodera.feature.puzzle.PuzzleRoute
import com.episodera.feature.search.SearchRoute
import com.episodera.feature.settings.SettingsRoute
import com.episodera.feature.social.SocialRoute
import com.episodera.feature.timeline.TimelineRoute
import com.episodera.feature.watchlist.WatchlistRoute
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
private data class BottomItem(
    val route: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

@Composable
fun EpisodEraApp() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .testTag(EPISODERA_APP_TEST_TAG),
    ) {
        EpisodEraAppContent()
    }
}

const val EPISODERA_APP_TEST_TAG = "episodera_app"

@Composable
private fun EpisodEraAppContent() {
    val siteAccess: SiteAccessViewModel = hiltViewModel()
    val blocked by siteAccess.blocked.collectAsStateWithLifecycle()
    if (blocked) {
        BlockedScreen()
        return
    }

    val navController = rememberNavController()
    val auth = remember { FirebaseAuth.getInstance() }
    var signedIn by remember { mutableStateOf(auth.currentUser != null) }
    LaunchedEffect(Unit) {
        auth.addAuthStateListener { signedIn = it.currentUser != null }
    }

    val bottomItems = listOf(
        BottomItem(AppDestinations.HOME, "Home", Icons.Default.Home),
        BottomItem(AppDestinations.SEARCH, "Search", Icons.Default.Search),
        BottomItem(AppDestinations.WATCHLIST, "Watchlist", Icons.AutoMirrored.Filled.List),
        BottomItem(AppDestinations.LIKES, "Liked", Icons.Default.Favorite),
        BottomItem(AppDestinations.PROFILE, "Profile", Icons.Default.Person),
    )
    val secondaryRoutes = setOf(
        AppDestinations.TIMELINE,
        AppDestinations.FRANCHISES,
        AppDestinations.PUZZLE,
        AppDestinations.SOCIAL,
        AppDestinations.SETTINGS,
    )

    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = currentRoute in bottomItems.map { it.route } || currentRoute in secondaryRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomItems.forEach { item ->
                        NavigationBarItem(
                            selected = currentRoute == item.route,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = if (signedIn) AppDestinations.HOME else AppDestinations.HOME,
            modifier = Modifier.padding(padding),
        ) {
            composable(AppDestinations.HOME) {
                Column {
                    SecondaryNav(
                        onTimeline = { navController.navigate(AppDestinations.TIMELINE) },
                        onFranchises = { navController.navigate(AppDestinations.FRANCHISES) },
                        onPuzzle = { navController.navigate(AppDestinations.PUZZLE) },
                        onSocial = { navController.navigate(AppDestinations.SOCIAL) },
                        onSettings = { navController.navigate(AppDestinations.SETTINGS) },
                        onAuth = { navController.navigate(AppDestinations.AUTH) },
                        signedIn = signedIn,
                    )
                    HomeRoute(
                        onOpenMedia = { type, id ->
                            navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                        },
                        onOpenList = { listId -> navController.navigate(AppDestinations.discoveryList(listId)) },
                    )
                }
            }
            composable(AppDestinations.SEARCH) {
                SearchRoute(
                    onOpenMedia = { type, id ->
                        navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                    },
                )
            }
            composable(AppDestinations.WATCHLIST) {
                WatchlistRoute(
                    onOpenDetail = { type, id ->
                        navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                    },
                )
            }
            composable(AppDestinations.LIKES) {
                LikesRoute(
                    onOpenDetail = { type, id ->
                        navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                    },
                )
            }
            composable(AppDestinations.TIMELINE) { TimelineRoute() }
            composable(AppDestinations.PROFILE) {
                ProfileRoute(
                    onSignOut = {
                        auth.signOut()
                        navController.navigate(AppDestinations.HOME) {
                            popUpTo(AppDestinations.HOME) { inclusive = true }
                        }
                    },
                )
            }
            composable(AppDestinations.SETTINGS) { SettingsRoute() }
            composable(AppDestinations.SOCIAL) { SocialRoute() }
            composable(AppDestinations.PUZZLE) { PuzzleRoute() }
            composable(AppDestinations.FRANCHISES) {
                FranchisesRoute(
                    onOpenMedia = { type, id ->
                        navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                    },
                )
            }
            composable(AppDestinations.AUTH) {
                AuthRoute(
                    onAuthenticated = {
                        navController.navigate(AppDestinations.HOME) {
                            popUpTo(AppDestinations.AUTH) { inclusive = true }
                        }
                    },
                )
            }
            composable(
                route = AppDestinations.MOVIE_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
                deepLinks = listOf(
                    navDeepLink { uriPattern = "https://episodera.web.app/movie/{id}" },
                    navDeepLink { uriPattern = "episodera://movie/{id}" },
                ),
            ) { entry ->
                MovieDetailRoute(
                    id = entry.arguments?.getInt("id") ?: 0,
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = AppDestinations.TV_DETAIL,
                arguments = listOf(navArgument("id") { type = NavType.IntType }),
                deepLinks = listOf(
                    navDeepLink { uriPattern = "https://episodera.web.app/tv/{id}" },
                    navDeepLink { uriPattern = "episodera://tv/{id}" },
                ),
            ) { entry ->
                TvDetailRoute(
                    id = entry.arguments?.getInt("id") ?: 0,
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                route = AppDestinations.DISCOVERY_LIST,
                arguments = listOf(navArgument("listId") { type = NavType.StringType }),
            ) { entry ->
                DiscoveryListRoute(
                    listId = entry.arguments?.getString("listId").orEmpty(),
                    onOpenMedia = { type, id ->
                        navController.navigate(if (type == "movie") AppDestinations.movieDetail(id) else AppDestinations.tvDetail(id))
                    },
                    onBack = { navController.popBackStack() },
                )
            }
            composable(AppDestinations.BLOCKED) { BlockedScreen() }
        }
    }
}

@Composable
private fun SecondaryNav(
    onTimeline: () -> Unit,
    onFranchises: () -> Unit,
    onPuzzle: () -> Unit,
    onSocial: () -> Unit,
    onSettings: () -> Unit,
    onAuth: () -> Unit,
    signedIn: Boolean,
) {
    androidx.compose.foundation.layout.Row(Modifier.padding(horizontal = 8.dp)) {
        TextButton(onClick = onTimeline) { Text("Timeline") }
        TextButton(onClick = onFranchises) { Text("Franchises") }
        TextButton(onClick = onPuzzle) { Icon(Icons.Default.PlayArrow, null); Text("Puzzle") }
        TextButton(onClick = onSocial) { Icon(Icons.Default.Share, null); Text("Social") }
        TextButton(onClick = onSettings) { Icon(Icons.Default.Settings, null) }
        if (!signedIn) {
            TextButton(onClick = onAuth) { Text("Sign in") }
        }
    }
}

@Composable
private fun BlockedScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
            Text("Episodera", style = MaterialTheme.typography.headlineLarge)
            Text(
                "Access is temporarily paused. Please try again later.",
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

@HiltViewModel
class DiscoveryListViewModel @Inject constructor(
    private val repository: EpisodEraRepository,
) : ViewModel() {
    var loading by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var title by mutableStateOf("")
        private set
    var results by mutableStateOf<List<MediaSummary>>(emptyList())
        private set

    fun load(listId: String) = viewModelScope.launch {
        loading = true
        error = null
        runCatching { repository.discoveryList(listId) }
            .onSuccess {
                title = it.title
                results = it.results
                loading = false
            }
            .onFailure {
                error = it.message ?: "Could not load list"
                loading = false
            }
    }
}

@Composable
private fun DiscoveryListRoute(
    listId: String,
    onOpenMedia: (String, Int) -> Unit,
    onBack: () -> Unit,
    viewModel: DiscoveryListViewModel = hiltViewModel(),
) {
    LaunchedEffect(listId) { viewModel.load(listId) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        TextButton(onClick = onBack) { Text("Back") }
        Text(viewModel.title.ifBlank { listId }, style = MaterialTheme.typography.headlineSmall)
        when {
            viewModel.loading -> CircularProgressIndicator(Modifier.padding(24.dp))
            viewModel.error != null -> {
                Text(viewModel.error!!)
                Button(onClick = { viewModel.load(listId) }) { Text("Retry") }
            }
            else -> LazyVerticalGrid(columns = GridCells.Fixed(2)) {
                items(viewModel.results) { item ->
                    Column(
                        Modifier
                            .padding(8.dp)
                            .clickable { onOpenMedia(item.mediaType.wireValue, item.id) },
                    ) {
                        AsyncImage(
                            model = item.images.poster,
                            contentDescription = item.title,
                            modifier = Modifier.fillMaxWidth().height(200.dp),
                            contentScale = ContentScale.Crop,
                        )
                        Text(item.title, maxLines = 2)
                    }
                }
            }
        }
    }
}
