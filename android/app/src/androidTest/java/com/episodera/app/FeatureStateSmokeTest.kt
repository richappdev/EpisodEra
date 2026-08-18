package com.episodera.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.episodera.feature.franchises.FranchiseDetail
import com.episodera.feature.franchises.FranchiseMedia
import com.episodera.feature.franchises.FranchisesScreen
import com.episodera.feature.franchises.FranchisesUiState
import com.episodera.feature.social.SocialScreen
import com.episodera.feature.social.SocialUiState
import com.episodera.feature.watchlist.WatchlistScreen
import com.episodera.feature.watchlist.WatchlistTab
import com.episodera.feature.watchlist.WatchlistTitle
import com.episodera.feature.watchlist.WatchlistUiState
import org.junit.Rule
import org.junit.Test

class FeatureStateSmokeTest {
    @get:Rule val compose = createComposeRule()

    @Test fun watchlistStatusMenuRemainsOpenAfterRecomposition() {
        compose.setContent {
            MaterialTheme {
                WatchlistScreen(
                    state = WatchlistUiState(selectedTab = WatchlistTab.ACTIVE, titles = listOf(WatchlistTitle("one", 1, "tv", "Show", "watching")), isLoading = false),
                    onTab = {}, onStatus = { _, _ -> }, onRemove = {}, onMarkNext = {}, onOpenDetail = { _, _ -> }, onRetry = {},
                )
            }
        }
        compose.onNodeWithText("watching").performClick()
        compose.onNodeWithText("planned").assertIsDisplayed()
    }

    @Test fun socialFriendCodeInputRetainsTypedText() {
        compose.setContent {
            MaterialTheme { SocialScreen(SocialUiState(loading = false), {}, { _, _ -> }, {}, {}) }
        }
        compose.onNodeWithText("Friend code").performTextInput("ABC123")
        compose.onNodeWithText("ABC123").assertTextEquals("ABC123")
    }

    @Test fun franchiseOrderingToggleChangesLabel() {
        val detail = FranchiseDetail("Saga", 0, 1, listOf(FranchiseMedia(1, "movie", "Release")), listOf(FranchiseMedia(1, "movie", "Chronological")))
        compose.setContent { MaterialTheme { FranchisesScreen(FranchisesUiState(detail = detail, loading = false), {}, {}, { _, _ -> }) } }
        compose.onNodeWithText("Release order").performClick()
        compose.onNodeWithText("Chronological order").assertIsDisplayed()
    }
}
