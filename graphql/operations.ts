import { gql, type TypedDocumentNode } from "@apollo/client";
import type {
  AdminBillingSummary,
  AdminMpesaCallback,
  AdminPayment,
  AdminPaymentCounts,
  AdminPaymentTab,
  MpesaCallbackStatus,
  AdminBoostCounts,
  AdminContentCounts,
  AdminConversationCounts,
  AdminUserCounts,
  AdminAppRatingOverview,
  AdminAppRatingSort,
  AppRatingRaterSegment,
  PaginatedAdminAppRatings,
  AdminConversationAnalytics,
  AdminConversationQueue,
  AdminCreatorDetail,
  AdminCreatorSort,
  AdminPostSort,
  AdminAnalytics,
  AdminContent,
  AdminDashboardStats,
  AdminGrowthAnalytics,
  AdminGrowthPulse,
  AdminLocationAnalytics,
  AdminSystemOverview,
  AdminContentMediaItemInput,
  AdminDraft,
  AdminDraftCounts,
  AdminDraftDetailsInput,
  AdminDraftMediaRetryResult,
  AdminDraftPublishResult,
  AdminDraftTab,
  AdminUser,
  Boost,
  BoostListItem,
  BoostPackage,
  BoostStatus,
  BoostTier,
  PaginationMeta,
  AdminUserDeletionSummary,
  AdminReferralOverview,
  AdminImageSearchMetrics,
  AdminReferralRewardRow,
  AdminReferralRow,
  Referral,
  ReferralReward,
  ReferralRewardStatus,
  ReferralStatus,
  AdminMediaRecoverySummary,
  AdminPostMediaRecovery,
  AdminSendTeamMessageInput,
  PaginatedTeamBroadcasts,
  PaginatedTeamThreads,
  TeamBroadcast,
  TeamMessage,
  TeamMessagePage,
  ImageUploadSession,
  VideoUploadSession,
  AdminImpersonationPayload,
  AttributionMedium,
  AuthPayload,
  Category,
  ContentStatus,
  PaginatedAdminConversations,
  PaginatedContent,
  PaginatedCreators,
  PaginatedUsers,
  SellerPerformance,
  TiktokSaverEventPage,
  TiktokSaverEventType,
  TiktokSaverOutcome,
  TiktokSaverOverview,
  UserRole,
  WebPushStatus,
  AdminApproveShopVerificationInput,
  AdminGrantShopVerificationInput,
  AdminRejectShopVerificationInput,
  AdminRevokeShopVerificationInput,
  AdminShopVerification,
  AdminShopVerificationCounts,
  PaginatedAdminShopVerifications,
  ShopVerificationStatus,
} from "./types";

// ── Fragments ────────────────────────────────────────────────────────────────

const ADMIN_USER_FIELDS = gql`
  fragment AdminUserFields on User {
    id
    email
    username
    role
    roles
    isVerified
    isSuspended
    suspendedAt
    suspensionReason
    profileVisitCount
    socialProof {
      featured
      headline
      sortOrder
      featuredAt
    }
    authProviders {
      local
      google
      facebook
      apple
      tiktok
    }
    profile {
      firstName
      lastName
      avatar
      bio
    }
    attribution {
      source
      medium
      campaign
      referrer
      landingPath
      hoursToSignup
    }
    createdAt
  }
`;

/**
 * Signup device, selected separately rather than folded into AdminUserFields.
 *
 * The field is @Authorized(ADMIN) on the server, and that fragment is also used
 * by the login mutation — which runs before the caller has a session at all.
 * Adding it there would make every admin login request a field it is not yet
 * allowed to read.
 */
const SIGNUP_DEVICE_FIELDS = gql`
  fragment SignupDeviceFields on User {
    signupDevice {
      deviceType
      operatingSystem
      browser
      firstSeenAt
    }
    adminLocation {
      source
      approximate
      county
      subCounty
      ward
      city
      country
      isp
    }
  }
`;

/** Exported so detail panels can follow a post through the cache (useFragment). */
export const ADMIN_CONTENT_FIELDS = gql`
  fragment AdminContentFields on Content {
    id
    listingNumber
    title
    slug
    caption
    type
    source
    isTiktokImport
    isBulk
    creationMethod
    status
    isLive
    processingError
    hashtags
    price {
      amount
      currency
      negotiable
    }
    media {
      mediaType
      url
      imageUrl
      thumbnailUrl
      processingStatus
      muxMeta {
        playbackId
        thumbnailUrl
        duration
      }
    }
    tiktokEmbed {
      videoId
      shareUrl
      coverImageUrl
      title
      authorUsername
    }
    stats {
      views
      likes
      comments
      shares
      saves
      messagesStarted
      profileVisits
      productClicks
    }
    approval {
      isApproved
      approvedBy
      approvedAt
      rejectionReason
      rejectedAt
    }
    moderation {
      isReported
      reportCount
    }
    boost {
      isBoosted
      tier
      multiplier
      priority
      startsAt
      expiresAt
      boostId
    }
    location {
      county
      subregion
      placeName
    }
    creator {
      id
      email
      username
      profile {
        firstName
        lastName
        avatar
      }
    }
    createdAt
  }
`;

/**
 * Who invited a post's creator. Selected by the posts table only, not folded
 * into AdminContentFields: it is resolved per creator, and the overview and
 * system queries that share that fragment never show it.
 */
const CREATOR_REFERRAL_FIELDS = gql`
  fragment CreatorReferralFields on User {
    referredBy {
      referralId
      code
      source
      status
      referredAt
      referrer {
        id
        email
        username
        profile {
          firstName
          lastName
          avatar
        }
      }
    }
  }
`;

// ── Auth ─────────────────────────────────────────────────────────────────────

export const ADMIN_LOGIN: TypedDocumentNode<
  { adminLogin: AuthPayload },
  { input: { email: string; password: string } }
> = gql`
  mutation AdminLogin($input: AdminLoginInput!) {
    adminLogin(input: $input) {
      accessToken
      refreshToken
      user {
        ...AdminUserFields
      }
    }
  }
  ${ADMIN_USER_FIELDS}
`;

export const LOGOUT: TypedDocumentNode<{ logout: boolean }, { refreshToken: string }> = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

export const ADMIN_CREATE_ACCOUNT: TypedDocumentNode<
  { adminCreateAccount: AuthPayload },
  {
    input: {
      email: string;
      password: string;
      roles: UserRole[];
      firstName?: string;
      lastName?: string;
    };
  }
> = gql`
  mutation AdminCreateAccount($input: AdminCreateAccountInput!) {
    adminCreateAccount(input: $input) {
      accessToken
      refreshToken
      user {
        ...AdminUserFields
      }
    }
  }
  ${ADMIN_USER_FIELDS}
`;

// ── Dashboard ────────────────────────────────────────────────────────────────

export const ADMIN_DASHBOARD_STATS: TypedDocumentNode<
  { adminDashboardStats: AdminDashboardStats },
  Record<string, never>
> = gql`
  query AdminDashboardStats {
    adminDashboardStats {
      totalUsers
      newUsersToday
      newUsersThisWeek
      adminCount
      suspendedUsers
      totalContent
      pendingReviewContent
      activeContent
      processingContent
      rejectedContent
      removedContent
      failedContent
      underReviewContent
      reportedContent
      totalViews
      totalLikes
    }
  }
`;

/**
 * Posts waiting for approval, for the Posts nav badge. Updated on socket events.
 */
export const ADMIN_PENDING_REVIEW_COUNT: TypedDocumentNode<
  { adminPendingReviewCount: number },
  Record<string, never>
> = gql`
  query AdminPendingReviewCount {
    adminPendingReviewCount
  }
`;

export const ADMIN_ANALYTICS: TypedDocumentNode<
  { adminAnalytics: AdminAnalytics },
  { days?: number }
> = gql`
  query AdminAnalytics($days: Int) {
    adminAnalytics(days: $days) {
      from
      to
      usersBefore
      postsBefore
      userGrowth {
        date
        count
      }
      postGrowth {
        date
        count
      }
      activeUsers {
        date
        count
      }
      engagementByDay {
        date
        views
        likes
        comments
        shares
        saves
        productClicks
      }
      contentByStatus {
        key
        label
        count
      }
      topCategories {
        key
        label
        count
      }
      topCounties {
        key
        label
        count
      }
      topCreators {
        creatorId
        username
        email
        profile {
          firstName
          lastName
          avatar
        }
        postCount
        totalViews
        totalSaves
        totalLikes
        totalComments
        totalShares
        totalEngagement
      }
    }
  }
`;

export const ADMIN_GROWTH_ANALYTICS: TypedDocumentNode<
  { adminGrowthAnalytics: AdminGrowthAnalytics },
  { days?: number }
> = gql`
  query AdminGrowthAnalytics($days: Int) {
    adminGrowthAnalytics(days: $days) {
      from
      to
      trackedSessions
      repeatActiveUsers
      creatorCount
      activeCreators
      pendingApprovalPosts
      totalViews
      totalSaves
      totalProductClicks
      conversationsStarted
      dealsClosed
      userGrowth {
        date
        count
      }
      activeUsers {
        date
        count
      }
      creatorPosts {
        date
        count
      }
      conversationStarts {
        date
        count
      }
      funnel {
        key
        label
        count
      }
      deviceTypes {
        key
        label
        count
      }
      operatingSystems {
        key
        label
        count
      }
      browsers {
        key
        label
        count
      }
    }
  }
`;

export const ADMIN_GROWTH_PULSE: TypedDocumentNode<
  { adminGrowthPulse: AdminGrowthPulse },
  { days?: number; months?: number; from?: string | null; to?: string | null }
> = gql`
  query AdminGrowthPulse($days: Int, $months: Int, $from: String, $to: String) {
    adminGrowthPulse(days: $days, months: $months, from: $from, to: $to) {
      from
      to
      previousFrom
      previousTo
      windowDays
      totalUsers
      totalPosts
      daily {
        key
        label
        signups
        posts
        postingSellers
      }
      monthly {
        key
        label
        signups
        posts
        postingSellers
      }
      comparisons {
        key
        label
        current
        previous
        changePercent
        direction
      }
      activation {
        cohortSignups
        cohortActivated
        cohortActivationPercent
        medianHoursToFirstPost
        lifetimeUsers
        lifetimeActivated
        lifetimeActivationPercent
        repeatSellers
        postsPerPostingSeller
      }
    }
  }
`;

export const ADMIN_LOCATION_ANALYTICS: TypedDocumentNode<
  { adminLocationAnalytics: AdminLocationAnalytics },
  { days?: number }
> = gql`
  query AdminLocationAnalytics($days: Int) {
    adminLocationAnalytics(days: $days) {
      from
      to
      countiesCovered
      activeCounties
      countiesWithoutSupply
      creatorsRepresented
      activePosts
      pendingApprovalPosts
      postsInWindow
      totalViews
      totalSaves
      postGrowth {
        date
        count
      }
      countyActivationByDay {
        date
        count
      }
      statusMix {
        key
        label
        count
      }
      topCategories {
        key
        label
        count
      }
      topCounties {
        key
        label
        count
      }
      countyPerformance {
        countyId
        countyName
        countySlug
        countyCode
        totalPosts
        postsInWindow
        activePosts
        pendingPosts
        processingPosts
        rejectedPosts
        removedPosts
        totalViews
        totalSaves
        totalLikes
        totalComments
        totalShares
        totalEngagement
        creatorCount
        activeCreatorCount
        averageViewsPerPost
        averageSavesPerPost
        saveRatePercent
        topCategory
        latestPostAt
        peopleCount
      }
    }
  }
`;

export const ADMIN_CONVERSATION_ANALYTICS: TypedDocumentNode<
  { adminConversationAnalytics: AdminConversationAnalytics },
  { days?: number }
> = gql`
  query AdminConversationAnalytics($days: Int) {
    adminConversationAnalytics(days: $days) {
      from
      to
      totalConversations
      startedInWindow
      openConversations
      closedDeals
      reportedConversations
      sellerNeedsReply
      buyerNeedsReply
      totalMessages
      averageMessagesPerConversation
      staleConversations
      sellerReplyRate1hPercent
      sellerReplyRate24hPercent
      medianSellerFirstResponseMinutes
      conversationStarts {
        date
        count
      }
      dealsClosedByDay {
        date
        count
      }
      queueMix {
        key
        label
        count
      }
      reportReasons {
        key
        label
        count
      }
      topSellers {
        key
        label
        count
      }
    }
  }
`;

export const ADMIN_CONVERSATIONS: TypedDocumentNode<
  { adminConversations: PaginatedAdminConversations },
  { page?: number; limit?: number; queue?: AdminConversationQueue; search?: string | null }
> = gql`
  query AdminConversations($page: Int, $limit: Int, $queue: AdminConversationQueue, $search: String) {
    adminConversations(page: $page, limit: $limit, queue: $queue, search: $search) {
      data {
        conversation {
          id
          contentId
          sellerId
          buyerId
          lastMessageId
          lastMessageText
          lastMessageType
          lastMessageSenderId
          lastMessageAt
          sellerUnreadCount
          buyerUnreadCount
          messageCount
          firstMessageAt
          dealClosedAt
          dealClosedByUserId
          createdAt
          updatedAt
        }
        content {
          ...AdminContentFields
        }
        seller {
          ...AdminUserFields
        }
        buyer {
          ...AdminUserFields
        }
        reporter {
          ...AdminUserFields
        }
        reportedUser {
          ...AdminUserFields
        }
        isReported
        reportReason
        reportDetails
        reportedAt
        reportCount
        needsSellerReply
        needsBuyerReply
        dealClosed
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_CONTENT_FIELDS}
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_SYSTEM_OVERVIEW: TypedDocumentNode<
  { adminSystemOverview: AdminSystemOverview },
  Record<string, never>
> = gql`
  query AdminSystemOverview {
    adminSystemOverview {
      timestamp
      apiWorkersEnabled
      workerServiceOnline
      workerLastHeartbeatAt
      redisAvailable
      queuesAvailable
      totalAdmins
      lockedAdminAccounts
      suspendedUsers
      pendingReviewContent
      processingContent
      failedContent
      reportedContent
      scheduledPublishes
      failedSchedules
      integrations {
        key
        label
        healthy
        detail
      }
      recentFailedContent {
        ...AdminContentFields
      }
      oldestProcessingContent {
        ...AdminContentFields
      }
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

// ── Content moderation ───────────────────────────────────────────────────────

export const PENDING_APPROVAL_CONTENT: TypedDocumentNode<
  { pendingApprovalContent: AdminContent[] },
  { limit?: number; offset?: number }
> = gql`
  query PendingApprovalContent($limit: Int, $offset: Int) {
    pendingApprovalContent(limit: $limit, offset: $offset) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const ADMIN_CONTENT: TypedDocumentNode<
  { adminContent: PaginatedContent },
  {
    page?: number;
    limit?: number;
    status?: ContentStatus | null;
    search?: string | null;
    creatorId?: string | null;
    reported?: boolean | null;
    sort?: AdminPostSort;
  }
> = gql`
  query AdminContent(
    $page: Int
    $limit: Int
    $status: ContentStatus
    $search: String
    $creatorId: String
    $reported: Boolean
    $sort: AdminPostSort
  ) {
    adminContent(
      page: $page
      limit: $limit
      status: $status
      search: $search
      creatorId: $creatorId
      reported: $reported
      sort: $sort
    ) {
      data {
        ...AdminContentFields
        creator {
          id
          ...CreatorReferralFields
        }
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_CONTENT_FIELDS}
  ${CREATOR_REFERRAL_FIELDS}
`;

export const APPROVE_CONTENT: TypedDocumentNode<
  { approveContent: AdminContent },
  { contentId: string }
> = gql`
  mutation ApproveContent($contentId: String!) {
    approveContent(contentId: $contentId) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const REJECT_CONTENT: TypedDocumentNode<
  { rejectContent: AdminContent },
  { contentId: string; reason: string }
> = gql`
  mutation RejectContent($contentId: String!, $reason: String!) {
    rejectContent(contentId: $contentId, reason: $reason) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const SET_CONTENT_LIVE: TypedDocumentNode<
  { setContentLive: AdminContent },
  { contentId: string; live: boolean }
> = gql`
  mutation SetContentLive($contentId: String!, $live: Boolean!) {
    setContentLive(contentId: $contentId, live: $live) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const ADMIN_REMOVE_CONTENT: TypedDocumentNode<
  { adminRemoveContent: AdminContent },
  { contentId: string; reason?: string | null }
> = gql`
  mutation AdminRemoveContent($contentId: String!, $reason: String) {
    adminRemoveContent(contentId: $contentId, reason: $reason) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const ADMIN_TRIGGER_MEDIA_RECOVERY: TypedDocumentNode<
  { adminTriggerMediaRecovery: AdminMediaRecoverySummary },
  Record<string, never>
> = gql`
  mutation AdminTriggerMediaRecovery {
    adminTriggerMediaRecovery {
      triggeredAt
      scannedAssets
      imageJobs
      videoJobs
      stuckContents
      replayed
      tiktokJobs
      finishedNow
      stillEncoding
      missingOriginals
      failedNow
      queuesAvailable
    }
  }
`;

export const ADMIN_RECOVER_POST_MEDIA: TypedDocumentNode<
  { adminRecoverPostMedia: AdminPostMediaRecovery },
  { contentId: string }
> = gql`
  mutation AdminRecoverPostMedia($contentId: String!) {
    adminRecoverPostMedia(contentId: $contentId) {
      ready
      processing
      missing
      failed
      details
      content {
        ...AdminContentFields
      }
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

// ── Shopi team messages ──────────────────────────────────────────────────────

const TEAM_MESSAGE_FIELDS = gql`
  fragment TeamMessageFields on TeamMessage {
    id
    sender
    subject
    body
    mediaAssetId
    mediaAsset {
      type
      status
      thumbnailUrl
      r2Variants {
        url
        variant
        width
        height
      }
      muxMeta {
        playbackId
        thumbnailUrl
      }
    }
    broadcastId
    readAt
    createdAt
  }
`;

export const MY_WEB_PUSH_STATUS: TypedDocumentNode<{ myWebPushStatus: WebPushStatus }, Record<string, never>> = gql`
  query MyWebPushStatus {
    myWebPushStatus {
      isAvailable
      isEnabled
      isOptedOut
      activeSubscriptionCount
      publicKey
    }
  }
`;

export const SAVE_WEB_PUSH_SUBSCRIPTION: TypedDocumentNode<
  { saveWebPushSubscription: WebPushStatus },
  { input: { endpoint: string; p256dh: string; auth: string; locale?: string; userAgent?: string } }
> = gql`
  mutation SaveWebPushSubscription($input: SaveWebPushSubscriptionInput!) {
    saveWebPushSubscription(input: $input) {
      isAvailable
      isEnabled
      isOptedOut
      activeSubscriptionCount
      publicKey
    }
  }
`;

export const REMOVE_ALL_WEB_PUSH_SUBSCRIPTIONS: TypedDocumentNode<
  { removeAllWebPushSubscriptions: WebPushStatus },
  Record<string, never>
> = gql`
  mutation RemoveAllWebPushSubscriptions {
    removeAllWebPushSubscriptions {
      isAvailable
      isEnabled
      isOptedOut
      activeSubscriptionCount
      publicKey
    }
  }
`;

const TEAM_BROADCAST_FIELDS = gql`
  fragment TeamBroadcastFields on TeamBroadcast {
    id
    mediaAssetId
    subject
    body
    audience
    recipientCount
    respondentCount
    createdAt
  }
`;

export const ADMIN_TEAM_THREADS: TypedDocumentNode<
  { adminTeamThreads: PaginatedTeamThreads },
  {
    page?: number;
    limit?: number;
    unreadOnly?: boolean | null;
    broadcastId?: string | null;
    search?: string | null;
  }
> = gql`
  query AdminTeamThreads(
    $page: Int
    $limit: Int
    $unreadOnly: Boolean
    $broadcastId: String
    $search: String
  ) {
    adminTeamThreads(
      page: $page
      limit: $limit
      unreadOnly: $unreadOnly
      broadcastId: $broadcastId
      search: $search
    ) {
      unreadThreads
      data {
        id
        userId
        lastMessageAt
        lastMessagePreview
        lastMessageSender
        lastMemberReplyAt
        teamUnreadCount
        messageCount
        user {
          id
          email
          username
          isSuspended
          profile {
            firstName
            lastName
            avatar
          }
        }
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
`;

export const ADMIN_TEAM_UNREAD_THREADS: TypedDocumentNode<
  { adminTeamUnreadThreads: number },
  Record<string, never>
> = gql`
  query AdminTeamUnreadThreads {
    adminTeamUnreadThreads
  }
`;

export const ADMIN_TEAM_THREAD_MESSAGES: TypedDocumentNode<
  { adminTeamThreadMessages: TeamMessagePage },
  { userId: string; limit?: number; before?: string | null }
> = gql`
  query AdminTeamThreadMessages($userId: String!, $limit: Int, $before: String) {
    adminTeamThreadMessages(userId: $userId, limit: $limit, before: $before) {
      hasMore
      nextCursor
      items {
        ...TeamMessageFields
      }
    }
  }
  ${TEAM_MESSAGE_FIELDS}
`;

export const ADMIN_TEAM_BROADCASTS: TypedDocumentNode<
  { adminTeamBroadcasts: PaginatedTeamBroadcasts },
  { page?: number; limit?: number }
> = gql`
  query AdminTeamBroadcasts($page: Int, $limit: Int) {
    adminTeamBroadcasts(page: $page, limit: $limit) {
      data {
        ...TeamBroadcastFields
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${TEAM_BROADCAST_FIELDS}
`;

export const ADMIN_SEND_TEAM_MESSAGE: TypedDocumentNode<
  { adminSendTeamMessage: TeamBroadcast },
  { input: AdminSendTeamMessageInput }
> = gql`
  mutation AdminSendTeamMessage($input: AdminSendTeamMessageInput!) {
    adminSendTeamMessage(input: $input) {
      ...TeamBroadcastFields
    }
  }
  ${TEAM_BROADCAST_FIELDS}
`;

export const ADMIN_REPLY_TEAM_THREAD: TypedDocumentNode<
  { adminReplyTeamThread: TeamMessage },
  { userId: string; body: string; mediaAssetId?: string | null }
> = gql`
  mutation AdminReplyTeamThread($userId: String!, $body: String!, $mediaAssetId: String) {
    adminReplyTeamThread(userId: $userId, body: $body, mediaAssetId: $mediaAssetId) {
      ...TeamMessageFields
    }
  }
  ${TEAM_MESSAGE_FIELDS}
`;

export const ADMIN_MARK_TEAM_THREAD_READ: TypedDocumentNode<
  { adminMarkTeamThreadRead: boolean },
  { userId: string }
> = gql`
  mutation AdminMarkTeamThreadRead($userId: String!) {
    adminMarkTeamThreadRead(userId: $userId)
  }
`;

// ── Users ────────────────────────────────────────────────────────────────────

export const ADMIN_USERS: TypedDocumentNode<
  { adminUsers: PaginatedUsers },
  {
    page?: number;
    limit?: number;
    search?: string | null;
    role?: UserRole | null;
    suspended?: boolean | null;
    source?: string | null;
    medium?: AttributionMedium | null;
    socialProof?: boolean | null;
    verified?: boolean | null;
  }
> = gql`
  query AdminUsers(
    $page: Int
    $limit: Int
    $search: String
    $role: UserRole
    $suspended: Boolean
    $source: String
    $medium: AttributionMedium
    $socialProof: Boolean
    $verified: Boolean
  ) {
    adminUsers(
      page: $page
      limit: $limit
      search: $search
      role: $role
      suspended: $suspended
      source: $source
      medium: $medium
      socialProof: $socialProof
      verified: $verified
    ) {
      data {
        ...AdminUserFields
        ...SignupDeviceFields
        ...CreatorReferralFields
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_USER_FIELDS}
  ${SIGNUP_DEVICE_FIELDS}
  ${CREATOR_REFERRAL_FIELDS}
`;

export const ADMIN_UPDATE_USER_ROLES: TypedDocumentNode<
  { adminUpdateUserRoles: AdminUser },
  { userId: string; roles: UserRole[] }
> = gql`
  mutation AdminUpdateUserRoles($userId: String!, $roles: [UserRole!]!) {
    adminUpdateUserRoles(userId: $userId, roles: $roles) {
      ...AdminUserFields
    }
  }
  ${ADMIN_USER_FIELDS}
`;


export const ADMIN_SET_USER_SOCIAL_PROOF: TypedDocumentNode<
  { adminSetUserSocialProof: AdminUser },
  { userId: string; featured: boolean; headline?: string | null; sortOrder?: number | null }
> = gql`
  mutation AdminSetUserSocialProof(
    $userId: String!
    $featured: Boolean!
    $headline: String
    $sortOrder: Int
  ) {
    adminSetUserSocialProof(
      userId: $userId
      featured: $featured
      headline: $headline
      sortOrder: $sortOrder
    ) {
      ...AdminUserFields
    }
  }
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_SET_USER_SUSPENDED: TypedDocumentNode<
  { adminSetUserSuspended: AdminUser },
  { userId: string; suspended: boolean; reason?: string | null }
> = gql`
  mutation AdminSetUserSuspended($userId: String!, $suspended: Boolean!, $reason: String) {
    adminSetUserSuspended(userId: $userId, suspended: $suspended, reason: $reason) {
      ...AdminUserFields
    }
  }
  ${ADMIN_USER_FIELDS}
`;

// ── Boosts ───────────────────────────────────────────────────────────────────

export const BOOST_PACKAGES: TypedDocumentNode<
  { boostPackages: BoostPackage[] },
  Record<string, never>
> = gql`
  query BoostPackages {
    boostPackages {
      tier
      name
      description
      multiplier
      priority
      durationDays
      priceKes
    }
  }
`;

const BOOST_FIELDS = gql`
  fragment BoostFields on Boost {
    id
    contentId
    creatorId
    tier
    status
    multiplier
    priority
    durationDays
    priceKes
    startsAt
    endsAt
    createdBy
    note
    endedAt
    createdAt
  }
`;

export const ADMIN_BOOST_CONTENT: TypedDocumentNode<
  { adminBoostContent: Boost },
  { contentId: string; tier: BoostTier; durationDays?: number | null; note?: string | null }
> = gql`
  mutation AdminBoostContent(
    $contentId: String!
    $tier: BoostTier!
    $durationDays: Int
    $note: String
  ) {
    adminBoostContent(
      contentId: $contentId
      tier: $tier
      durationDays: $durationDays
      note: $note
    ) {
      ...BoostFields
    }
  }
  ${BOOST_FIELDS}
`;

export const ADMIN_CANCEL_BOOST: TypedDocumentNode<
  { adminCancelBoost: Boost },
  { boostId: string }
> = gql`
  mutation AdminCancelBoost($boostId: String!) {
    adminCancelBoost(boostId: $boostId) {
      ...BoostFields
    }
  }
  ${BOOST_FIELDS}
`;

export const ADMIN_BOOSTS: TypedDocumentNode<
  { adminBoosts: { data: BoostListItem[]; meta: PaginationMeta } },
  { page?: number; limit?: number; status?: BoostStatus | null; tier?: BoostTier | null }
> = gql`
  query AdminBoosts($page: Int, $limit: Int, $status: BoostStatus, $tier: BoostTier) {
    adminBoosts(page: $page, limit: $limit, status: $status, tier: $tier) {
      data {
        boost {
          ...BoostFields
        }
        content {
          ...AdminContentFields
        }
        creator {
          ...AdminUserFields
        }
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${BOOST_FIELDS}
  ${ADMIN_CONTENT_FIELDS}
  ${ADMIN_USER_FIELDS}
`;

// ── Media repair ─────────────────────────────────────────────────────────────
// Admins re-upload through the same MediaAsset mutations creators use, then hand
// the finished asset ids to adminUpdateContentMedia.

export const REQUEST_IMAGE_UPLOAD: TypedDocumentNode<
  { requestImageUpload: ImageUploadSession },
  { mimeType?: string | null }
> = gql`
  mutation RequestImageUpload($mimeType: String) {
    requestImageUpload(mimeType: $mimeType) {
      uploadUrl
      tempKey
      mediaAssetId
      uploadSessionId
    }
  }
`;

export const REQUEST_VIDEO_UPLOAD: TypedDocumentNode<
  { requestVideoUpload: VideoUploadSession },
  { corsOrigin?: string | null }
> = gql`
  mutation RequestVideoUpload($corsOrigin: String) {
    requestVideoUpload(corsOrigin: $corsOrigin) {
      uploadUrl
      muxUploadId
      mediaAssetId
      uploadSessionId
    }
  }
`;

export const NOTIFY_IMAGE_UPLOADED: TypedDocumentNode<
  { notifyImageUploaded: { id: string; status: string } },
  { mediaAssetId: string }
> = gql`
  mutation NotifyImageUploaded($mediaAssetId: String!) {
    notifyImageUploaded(mediaAssetId: $mediaAssetId) {
      id
      status
    }
  }
`;

export const NOTIFY_VIDEO_UPLOADED: TypedDocumentNode<
  { notifyVideoUploaded: { id: string; status: string } },
  { mediaAssetId: string }
> = gql`
  mutation NotifyVideoUploaded($mediaAssetId: String!) {
    notifyVideoUploaded(mediaAssetId: $mediaAssetId) {
      id
      status
    }
  }
`;

export const ADMIN_UPDATE_CONTENT_MEDIA: TypedDocumentNode<
  { adminUpdateContentMedia: AdminContent },
  { contentId: string; items: AdminContentMediaItemInput[] }
> = gql`
  mutation AdminUpdateContentMedia(
    $contentId: String!
    $items: [AdminContentMediaItemInput!]!
  ) {
    adminUpdateContentMedia(contentId: $contentId, items: $items) {
      ...AdminContentFields
    }
  }
  ${ADMIN_CONTENT_FIELDS}
`;

export const ADMIN_DELETE_USER: TypedDocumentNode<
  { adminDeleteUser: AdminUserDeletionSummary },
  { userId: string }
> = gql`
  mutation AdminDeleteUser($userId: String!) {
    adminDeleteUser(userId: $userId) {
      userId
      email
      deletedPosts
      deletedComments
      deletedDirectMessages
      deletedFollows
      deletedCommunities
      deletedMediaAssets
      updatedExternalReferences
    }
  }
`;

export const ADMIN_CREATE_IMPERSONATION_TOKEN: TypedDocumentNode<
  { adminCreateImpersonationToken: AdminImpersonationPayload },
  { userId: string }
> = gql`
  mutation AdminCreateImpersonationToken($userId: String!) {
    adminCreateImpersonationToken(userId: $userId) {
      token
      expiresAt
      targetUser {
        ...AdminUserFields
      }
    }
  }
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_CREATORS: TypedDocumentNode<
  { adminCreators: PaginatedCreators },
  {
    page?: number;
    limit?: number;
    search?: string | null;
    suspended?: boolean | null;
    sort?: AdminCreatorSort | null;
  }
> = gql`
  query AdminCreators(
    $page: Int
    $limit: Int
    $search: String
    $suspended: Boolean
    $sort: AdminCreatorSort
  ) {
    adminCreators(
      page: $page
      limit: $limit
      search: $search
      suspended: $suspended
      sort: $sort
    ) {
      data {
        creator {
          ...AdminUserFields
        }
        postCount
        activePostCount
        pendingPostCount
        processingPostCount
        rejectedPostCount
        removedPostCount
        totalViews
        totalSaves
        totalLikes
        totalComments
        totalShares
        totalEngagement
        averageViewsPerPost
        averageSavesPerPost
        saveRatePercent
        lastPostedAt
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_CREATOR_DETAIL: TypedDocumentNode<
  { adminCreatorDetail: AdminCreatorDetail },
  { creatorId: string; days?: number }
> = gql`
  query AdminCreatorDetail($creatorId: String!, $days: Int) {
    adminCreatorDetail(creatorId: $creatorId, days: $days) {
      creator {
        ...AdminUserFields
      }
      summary {
        creator {
          ...AdminUserFields
        }
        postCount
        activePostCount
        pendingPostCount
        processingPostCount
        rejectedPostCount
        removedPostCount
        totalViews
        totalSaves
        totalLikes
        totalComments
        totalShares
        totalEngagement
        averageViewsPerPost
        averageSavesPerPost
        saveRatePercent
        lastPostedAt
      }
      statusBreakdown {
        key
        label
        count
      }
      postActivity {
        date
        count
      }
      engagementByDay {
        date
        views
        likes
        comments
        shares
        saves
        productClicks
      }
      recentPosts {
        ...AdminContentFields
      }
      topPosts {
        ...AdminContentFields
      }
    }
  }
  ${ADMIN_USER_FIELDS}
  ${ADMIN_CONTENT_FIELDS}
`;

// ── Categories ───────────────────────────────────────────────────────────────

const CATEGORY_FIELDS = gql`
  fragment CategoryFields on Category {
    id
    name
    slug
    description
    imageUrl
    parentId
    depth
    sortOrder
    isActive
    contentCount
  }
`;

export const CATEGORIES: TypedDocumentNode<{ categories: Category[] }, Record<string, never>> = gql`
  query Categories {
    categories {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const ADMIN_CATEGORIES: TypedDocumentNode<
  { adminCategories: Category[] },
  Record<string, never>
> = gql`
  query AdminCategories {
    adminCategories {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const CREATE_CATEGORY: TypedDocumentNode<
  { createCategory: Category },
  {
    input: {
      name: string;
      slug: string;
      description?: string;
      imageUrl?: string | null;
      parentId?: string;
      sortOrder?: number;
    };
  }
> = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const UPDATE_CATEGORY: TypedDocumentNode<
  { updateCategory: Category },
  {
    id: string;
    input: {
      name?: string;
      slug?: string;
      description?: string;
      imageUrl?: string | null;
      sortOrder?: number;
    };
  }
> = gql`
  mutation UpdateCategory($id: String!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const SET_CATEGORY_ACTIVE: TypedDocumentNode<
  { setCategoryActive: Category },
  { id: string; active: boolean }
> = gql`
  mutation SetCategoryActive($id: String!, $active: Boolean!) {
    setCategoryActive(id: $id, active: $active) {
      ...CategoryFields
    }
  }
  ${CATEGORY_FIELDS}
`;

export const DELETE_CATEGORY: TypedDocumentNode<
  { deleteCategory: boolean },
  { id: string }
> = gql`
  mutation DeleteCategory($id: String!) {
    deleteCategory(id: $id)
  }
`;

// ── Social proof performance ─────────────────────────────────────────────────

export const ADMIN_SOCIAL_PROOF_PERFORMANCE: TypedDocumentNode<
  { adminSocialProofPerformance: SellerPerformance[] },
  { days?: number }
> = gql`
  query AdminSocialProofPerformance($days: Int) {
    adminSocialProofPerformance(days: $days) {
      sellerId
      username
      displayName
      avatar
      featured
      headline
      days
      impressions
      clicks
      clickThroughRate
      profileViews
      listingViews
      uniqueVisitors
      messageClicks
      contactReveals
      callClicks
      conversions
      conversionRate
      sources {
        source
        visits
        conversions
      }
      daily {
        date
        clicks
        visits
        conversions
      }
    }
  }
`;

// ── TikTok downloader ────────────────────────────────────────────────────────
// Usage of the public TikTok tool pages (/tiktok-downloader and friends):
// what is looked up and saved, by whom in aggregate, and how many go on to Shopi.

export const ADMIN_TIKTOK_SAVER_OVERVIEW: TypedDocumentNode<
  { adminTiktokSaverOverview: TiktokSaverOverview },
  { days?: number }
> = gql`
  fragment TiktokSaverTotalsFields on TiktokSaverTotals {
    lookups
    failedLookups
    downloads
    failedDownloads
    proxiedDownloads
    visitors
    downloaders
    ctaClicks
    signups
  }

  query AdminTiktokSaverOverview($days: Int) {
    adminTiktokSaverOverview(days: $days) {
      days
      from
      to
      granularity
      totals {
        ...TiktokSaverTotalsFields
      }
      previous {
        ...TiktokSaverTotalsFields
      }
      lookupSuccessRate
      downloadRate
      series {
        bucket
        lookups
        downloads
        visitors
      }
      byTool { key label count }
      byAsset { key label count }
      bySource { key label count }
      byReferrer { key label count }
      byDevice { key label count }
      byLocale { key label count }
      byCountry { key label count }
      byCity { key label count }
      byError { key label count }
      byCta { key label count }
      videoCount
      creatorCount
      topVideos {
        key
        tiktokId
        url
        authorUsername
        title
        kind
        lookups
        downloads
        visitors
        lastAt
      }
      topCreators {
        authorUsername
        videos
        lookups
        downloads
        lastAt
      }
    }
  }
`;

export const ADMIN_TIKTOK_SAVER_EVENTS: TypedDocumentNode<
  { adminTiktokSaverEvents: TiktokSaverEventPage },
  {
    limit?: number;
    after?: string | null;
    type?: TiktokSaverEventType | null;
    outcome?: TiktokSaverOutcome | null;
  }
> = gql`
  query AdminTiktokSaverEvents(
    $limit: Int
    $after: String
    $type: TiktokSaverEventType
    $outcome: TiktokSaverOutcome
  ) {
    adminTiktokSaverEvents(limit: $limit, after: $after, type: $type, outcome: $outcome) {
      hasMore
      nextCursor
      items {
        id
        type
        outcome
        tool
        asset
        error
        delivery
        cta
        tiktokUrl
        tiktokId
        authorUsername
        title
        postKind
        source
        referrerHost
        locale
        device
        os
        browser
        country
        city
        sessionId
        createdAt
      }
    }
  }
`;

// ── Referrals ────────────────────────────────────────────────────────────────
// Invite programme review and payouts. Rejecting a referral may withdraw an
// unpaid reward; marking one paid notifies the referrer.

const REFERRAL_FIELDS = gql`
  fragment ReferralFields on Referral {
    id
    referrerId
    refereeId
    code
    source
    status
    listingCount
    qualifiedAt
    rejectedAt
    rejectionReason
    createdAt
  }
`;

const REFERRAL_REWARD_FIELDS = gql`
  fragment ReferralRewardFields on ReferralReward {
    id
    referrerId
    referralId
    refereeId
    amountKes
    status
    paidAt
    mpesaReference
    paidToPhone
    cancelledAt
    cancelReason
    createdAt
  }
`;

export const ADMIN_REFERRAL_OVERVIEW: TypedDocumentNode<
  { adminReferralOverview: AdminReferralOverview },
  Record<string, never>
> = gql`
  query AdminReferralOverview {
    adminReferralOverview {
      totalReferrals
      pending
      qualified
      rejected
      referrers
      rewardsPending
      rewardsPendingKes
      rewardsPaid
      rewardsPaidKes
      terms {
        rewardKes
        minListings
        claimWindowDays
      }
    }
  }
`;

export const ADMIN_IMAGE_SEARCH_METRICS: TypedDocumentNode<
  { adminImageSearchMetrics: AdminImageSearchMetrics },
  { days?: number }
> = gql`
  query AdminImageSearchMetrics($days: Int) {
    adminImageSearchMetrics(days: $days) {
      total
      periodCount
      todayCount
      successCount
      noMatchCount
      errorCount
      limitedCount
      cachedCount
      homeCount
      marketCount
      signedInUsers
      daily { date count }
    }
  }
`;

export const ADMIN_REFERRALS: TypedDocumentNode<
  { adminReferrals: { data: AdminReferralRow[]; meta: PaginationMeta } },
  { page?: number; limit?: number; status?: ReferralStatus | null; referrerId?: string | null; search?: string | null }
> = gql`
  query AdminReferrals($page: Int, $limit: Int, $status: ReferralStatus, $referrerId: String, $search: String) {
    adminReferrals(page: $page, limit: $limit, status: $status, referrerId: $referrerId, search: $search) {
      data {
        referral {
          ...ReferralFields
        }
        referrer {
          ...AdminUserFields
        }
        referee {
          ...AdminUserFields
        }
        reward {
          ...ReferralRewardFields
        }
        referrerPhone
        refereePhone
        liveListingCount
        flags
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${REFERRAL_FIELDS}
  ${REFERRAL_REWARD_FIELDS}
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_REFERRAL_REWARDS: TypedDocumentNode<
  { adminReferralRewards: { data: AdminReferralRewardRow[]; meta: PaginationMeta } },
  { page?: number; limit?: number; status?: ReferralRewardStatus | null }
> = gql`
  query AdminReferralRewards($page: Int, $limit: Int, $status: ReferralRewardStatus) {
    adminReferralRewards(page: $page, limit: $limit, status: $status) {
      data {
        reward {
          ...ReferralRewardFields
        }
        referral {
          ...ReferralFields
        }
        referrer {
          ...AdminUserFields
        }
        referee {
          ...AdminUserFields
        }
        payoutPhone
        liveListingCount
        flags
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${REFERRAL_REWARD_FIELDS}
  ${REFERRAL_FIELDS}
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_MARK_REFERRAL_REWARD_PAID: TypedDocumentNode<
  { adminMarkReferralRewardPaid: ReferralReward },
  { rewardId: string; mpesaReference: string; phone?: string | null }
> = gql`
  mutation AdminMarkReferralRewardPaid($rewardId: String!, $mpesaReference: String!, $phone: String) {
    adminMarkReferralRewardPaid(rewardId: $rewardId, mpesaReference: $mpesaReference, phone: $phone) {
      ...ReferralRewardFields
    }
  }
  ${REFERRAL_REWARD_FIELDS}
`;

export const ADMIN_REJECT_REFERRAL: TypedDocumentNode<
  { adminRejectReferral: Referral },
  { referralId: string; reason: string }
> = gql`
  mutation AdminRejectReferral($referralId: String!, $reason: String!) {
    adminRejectReferral(referralId: $referralId, reason: $reason) {
      ...ReferralFields
    }
  }
  ${REFERRAL_FIELDS}
`;

export const ADMIN_RESTORE_REFERRAL: TypedDocumentNode<
  { adminRestoreReferral: Referral },
  { referralId: string }
> = gql`
  mutation AdminRestoreReferral($referralId: String!) {
    adminRestoreReferral(referralId: $referralId) {
      ...ReferralFields
    }
  }
  ${REFERRAL_FIELDS}
`;

// ── App ratings ──────────────────────────────────────────────────────────────

export const ADMIN_APP_RATINGS: TypedDocumentNode<
  { adminAppRatings: PaginatedAdminAppRatings },
  {
    page?: number;
    limit?: number;
    stars?: number[] | null;
    segment?: AppRatingRaterSegment | null;
    hasComment?: boolean | null;
    search?: string | null;
    sort?: AdminAppRatingSort | null;
  }
> = gql`
  query AdminAppRatings(
    $page: Int
    $limit: Int
    $stars: [Int!]
    $segment: AppRatingRaterSegment
    $hasComment: Boolean
    $search: String
    $sort: AdminAppRatingSort
  ) {
    adminAppRatings(
      page: $page
      limit: $limit
      stars: $stars
      segment: $segment
      hasComment: $hasComment
      search: $search
      sort: $sort
    ) {
      data {
        rating {
          id
          userId
          stars
          comment
          createdAt
          updatedAt
        }
        rater {
          ...AdminUserFields
          ...SignupDeviceFields
        }
        segment
        shop {
          listingCount
          liveListingCount
          inReviewListingCount
          blockedListingCount
          totalViews
          totalSaves
          lastPostedAt
          inquiriesReceived
          dealsClosed
          followerCount
        }
        conversationsStarted
        daysOnShopiAtRating
        revisedAt
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_USER_FIELDS}
  ${SIGNUP_DEVICE_FIELDS}
`;

export const ADMIN_APP_RATING_OVERVIEW: TypedDocumentNode<
  { adminAppRatingOverview: AdminAppRatingOverview },
  { days?: number }
> = gql`
  query AdminAppRatingOverview($days: Int) {
    adminAppRatingOverview(days: $days) {
      allTime {
        average
        total
        distribution
      }
      withCommentCount
      satisfiedPercent
      unhappyCount
      days
      windowCount
      windowAverage
      previousWindowCount
      previousWindowAverage
      daily {
        date
        count
      }
      segments {
        segment
        count
        average
        distribution
      }
      sellerTraction {
        key
        label
        count
        average
      }
      tenure {
        key
        label
        count
        average
      }
    }
  }
`;

// ── Tab counts ───────────────────────────────────────────────────────────────

export const ADMIN_CONTENT_COUNTS: TypedDocumentNode<
  { adminContentCounts: AdminContentCounts },
  { search?: string | null; creatorId?: string | null }
> = gql`
  query AdminContentCounts($search: String, $creatorId: String) {
    adminContentCounts(search: $search, creatorId: $creatorId) {
      all
      pendingReview
      active
      processing
      underReview
      rejected
      removed
      failed
      reported
    }
  }
`;

export const ADMIN_USER_COUNTS: TypedDocumentNode<
  { adminUserCounts: AdminUserCounts },
  { search?: string | null }
> = gql`
  query AdminUserCounts($search: String) {
    adminUserCounts(search: $search) {
      all
      sellers
      admins
      verified
      suspended
    }
  }
`;

export const ADMIN_CONVERSATION_COUNTS: TypedDocumentNode<
  { adminConversationCounts: AdminConversationCounts },
  { search?: string | null }
> = gql`
  query AdminConversationCounts($search: String) {
    adminConversationCounts(search: $search) {
      all
      sellerNeedsReply
      buyerNeedsReply
      reported
      openDeals
      closedDeals
    }
  }
`;

export const ADMIN_BOOST_COUNTS: TypedDocumentNode<
  { adminBoostCounts: AdminBoostCounts },
  { tier?: BoostTier | null }
> = gql`
  query AdminBoostCounts($tier: BoostTier) {
    adminBoostCounts(tier: $tier) {
      all
      active
      expired
      cancelled
    }
  }
`;

// ── Drafts ───────────────────────────────────────────────────────────────────

/** Exported so the draft panel can follow a draft through the cache. */
export const ADMIN_DRAFT_FIELDS = gql`
  fragment AdminDraftFields on AdminDraft {
    id
    creatorId
    status
    currentStep
    creationMethod
    type
    source
    title
    caption
    hashtags
    price {
      amount
      currency
      negotiable
    }
    specs {
      key
      value
    }
    categoryName
    subcategoryName
    location {
      placeName
      formattedAddress
      county
      subregion
    }
    contactPhone
    isBulk
    isTiktokImport
    scheduledPublishAt
    publishedContentId
    lastPublishError
    lastPublishErrorAt
    publishFailureCount
    media {
      id
      type
      health
      thumbnailUrl
      url
      muxPlaybackId
      errorMessage
      problem
      retryable
      updatedAt
    }
    unusableMediaCount
    issues {
      code
      message
      blocking
    }
    canPublish
    creator {
      id
      email
      username
      profile {
        firstName
        lastName
        avatar
      }
    }
    createdAt
    updatedAt
  }
`;

export const ADMIN_DRAFTS: TypedDocumentNode<
  { adminDrafts: { data: AdminDraft[]; meta: PaginationMeta } },
  {
    tab: AdminDraftTab;
    page?: number;
    limit?: number;
    search?: string | null;
    creatorId?: string | null;
  }
> = gql`
  query AdminDrafts(
    $tab: AdminDraftTab!
    $page: Int
    $limit: Int
    $search: String
    $creatorId: String
  ) {
    adminDrafts(tab: $tab, page: $page, limit: $limit, search: $search, creatorId: $creatorId) {
      data {
        ...AdminDraftFields
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_DRAFT_FIELDS}
`;

export const ADMIN_DRAFT_COUNTS: TypedDocumentNode<
  { adminDraftCounts: AdminDraftCounts },
  { search?: string | null; creatorId?: string | null }
> = gql`
  query AdminDraftCounts($search: String, $creatorId: String) {
    adminDraftCounts(search: $search, creatorId: $creatorId) {
      attention
      active
      scheduled
      published
      discarded
    }
  }
`;

export const ADMIN_PUBLISH_DRAFT: TypedDocumentNode<
  { adminPublishDraft: AdminDraftPublishResult },
  { id: string; removeUnusableMedia?: boolean; approve?: boolean }
> = gql`
  mutation AdminPublishDraft($id: String!, $removeUnusableMedia: Boolean, $approve: Boolean) {
    adminPublishDraft(id: $id, removeUnusableMedia: $removeUnusableMedia, approve: $approve) {
      approved
      approvalError
      removedMediaCount
      content {
        ...AdminContentFields
      }
      draft {
        ...AdminDraftFields
      }
    }
  }
  ${ADMIN_CONTENT_FIELDS}
  ${ADMIN_DRAFT_FIELDS}
`;

export const ADMIN_REMOVE_DRAFT_UNUSABLE_MEDIA: TypedDocumentNode<
  { adminRemoveDraftUnusableMedia: AdminDraft },
  { id: string }
> = gql`
  mutation AdminRemoveDraftUnusableMedia($id: String!) {
    adminRemoveDraftUnusableMedia(id: $id) {
      ...AdminDraftFields
    }
  }
  ${ADMIN_DRAFT_FIELDS}
`;

export const ADMIN_RETRY_DRAFT_MEDIA: TypedDocumentNode<
  { adminRetryDraftMedia: AdminDraftMediaRetryResult },
  { id: string }
> = gql`
  mutation AdminRetryDraftMedia($id: String!) {
    adminRetryDraftMedia(id: $id) {
      requeued
      unrecoverable
      draft {
        ...AdminDraftFields
      }
    }
  }
  ${ADMIN_DRAFT_FIELDS}
`;

export const ADMIN_UPDATE_DRAFT_DETAILS: TypedDocumentNode<
  { adminUpdateDraftDetails: AdminDraft },
  { id: string; input: AdminDraftDetailsInput }
> = gql`
  mutation AdminUpdateDraftDetails($id: String!, $input: AdminDraftDetailsInput!) {
    adminUpdateDraftDetails(id: $id, input: $input) {
      ...AdminDraftFields
    }
  }
  ${ADMIN_DRAFT_FIELDS}
`;

export const ADMIN_DISCARD_DRAFT: TypedDocumentNode<
  { adminDiscardDraft: AdminDraft },
  { id: string }
> = gql`
  mutation AdminDiscardDraft($id: String!) {
    adminDiscardDraft(id: $id) {
      ...AdminDraftFields
    }
  }
  ${ADMIN_DRAFT_FIELDS}
`;

// ── Shop verification ────────────────────────────────────────────────────────

const SHOP_VERIFICATION_FIELDS = gql`
  fragment ShopVerificationFields on ShopVerification {
    id
    status
    businessName
    location {
      county
      countyId
      subregion
      wardName
      placeName
      formattedAddress
      placeId
      addressLine
      latitude
      longitude
    }
    permit {
      kind
      fileName
      contentType
      isPdf
      sizeBytes
      width
      height
      uploadedAt
      url
      urlExpiresAt
    }
    shopPhoto {
      kind
      fileName
      contentType
      isPdf
      sizeBytes
      width
      height
      uploadedAt
      url
      urlExpiresAt
    }
    missing
    canEdit
    submittedAt
    firstSubmittedAt
    submissionCount
    reviewedAt
    issues {
      issue
      title
      detail
      requirement
    }
    decisionNote
    verifiedAt
    revokedAt
    createdAt
    updatedAt
  }
`;

const ADMIN_SHOP_VERIFICATION_ROW_FIELDS = gql`
  fragment AdminShopVerificationRowFields on AdminShopVerification {
    userId
    grantedManually
    reviewerName
    permitExpiresAt
    internalNote
    applicant {
      id
      username
      displayName
      email
      avatar
      contactPhone
      isVerified
      isSuspended
      memberSince
      liveListingCount
    }
    application {
      ...ShopVerificationFields
    }
  }
  ${SHOP_VERIFICATION_FIELDS}
`;

/** Everything the review panel shows. Every decision returns this too. */
const ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS = gql`
  fragment AdminShopVerificationDetailFields on AdminShopVerification {
    ...AdminShopVerificationRowFields
    listingCountyMatches
    photoCheck {
      hasCameraDetails
      camera
      takenAt
      software
      hasLocation
      distanceFromPinKm
    }
    listingPlaces {
      label
      county
      count
    }
    events {
      type
      at
      actorName
      note
      internalNote
      issues {
        issue
        title
      }
      guidanceFiles {
        fileName
        contentType
        sizeBytes
        url
        urlExpiresAt
      }
    }
  }
  ${ADMIN_SHOP_VERIFICATION_ROW_FIELDS}
`;

export const ADMIN_SHOP_VERIFICATIONS: TypedDocumentNode<
  { adminShopVerifications: PaginatedAdminShopVerifications },
  { page: number; limit: number; status?: ShopVerificationStatus | null; search?: string | null }
> = gql`
  query AdminShopVerifications($page: Int!, $limit: Int!, $status: ShopVerificationStatus, $search: String) {
    adminShopVerifications(page: $page, limit: $limit, status: $status, search: $search) {
      data {
        ...AdminShopVerificationRowFields
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_SHOP_VERIFICATION_ROW_FIELDS}
`;

export const ADMIN_SHOP_VERIFICATION_COUNTS: TypedDocumentNode<
  { adminShopVerificationCounts: AdminShopVerificationCounts },
  { search?: string | null }
> = gql`
  query AdminShopVerificationCounts($search: String) {
    adminShopVerificationCounts(search: $search) {
      pending
      approved
      rejected
      revoked
      draft
      all
    }
  }
`;

export const ADMIN_PENDING_SHOP_VERIFICATION_COUNT: TypedDocumentNode<
  { adminPendingShopVerificationCount: number },
  Record<string, never>
> = gql`
  query AdminPendingShopVerificationCount {
    adminPendingShopVerificationCount
  }
`;

export const ADMIN_SHOP_VERIFICATION: TypedDocumentNode<
  { adminShopVerification: AdminShopVerification },
  { userId: string }
> = gql`
  query AdminShopVerification($userId: String!) {
    adminShopVerification(userId: $userId) {
      ...AdminShopVerificationDetailFields
    }
  }
  ${ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS}
`;

export const ADMIN_APPROVE_SHOP_VERIFICATION: TypedDocumentNode<
  { adminApproveShopVerification: AdminShopVerification },
  { userId: string; input?: AdminApproveShopVerificationInput | null }
> = gql`
  mutation AdminApproveShopVerification($userId: String!, $input: AdminApproveShopVerificationInput) {
    adminApproveShopVerification(userId: $userId, input: $input) {
      ...AdminShopVerificationDetailFields
    }
  }
  ${ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS}
`;

export const ADMIN_REJECT_SHOP_VERIFICATION: TypedDocumentNode<
  { adminRejectShopVerification: AdminShopVerification },
  { userId: string; input: AdminRejectShopVerificationInput }
> = gql`
  mutation AdminRejectShopVerification($userId: String!, $input: AdminRejectShopVerificationInput!) {
    adminRejectShopVerification(userId: $userId, input: $input) {
      ...AdminShopVerificationDetailFields
    }
  }
  ${ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS}
`;

export const ADMIN_REVOKE_SHOP_VERIFICATION: TypedDocumentNode<
  { adminRevokeShopVerification: AdminShopVerification },
  { userId: string; input: AdminRevokeShopVerificationInput }
> = gql`
  mutation AdminRevokeShopVerification($userId: String!, $input: AdminRevokeShopVerificationInput!) {
    adminRevokeShopVerification(userId: $userId, input: $input) {
      ...AdminShopVerificationDetailFields
    }
  }
  ${ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS}
`;

export const ADMIN_GRANT_SHOP_VERIFICATION: TypedDocumentNode<
  { adminGrantShopVerification: AdminShopVerification },
  { userId: string; input: AdminGrantShopVerificationInput }
> = gql`
  mutation AdminGrantShopVerification($userId: String!, $input: AdminGrantShopVerificationInput!) {
    adminGrantShopVerification(userId: $userId, input: $input) {
      ...AdminShopVerificationDetailFields
    }
  }
  ${ADMIN_SHOP_VERIFICATION_DETAIL_FIELDS}
`;

// ── Billing (M-Pesa) ──────────────────────────────────────────────────────────

const ADMIN_PAYMENT_FIELDS = gql`
  fragment AdminPaymentFields on AdminPayment {
    id
    reference
    status
    amount
    currency
    phone
    itemLabel
    targetId
    itemCode
    receipt
    failureReason
    moneyReceived
    createdAt
    paidAt
    completedAt
    failedAt
    refundedAt
    userId
    user {
      ...AdminUserFields
    }
    phoneRaw
    confirmedVia
    failureCode
    reviewReason
    checkoutRequestId
    merchantRequestId
    resultCode
    resultDesc
    paidAmount
    paidPhone
    transactionDate
    deliveredRef
    deliveryAttempts
    deliveryError
    checkAttempts
    nextCheckAt
    stkSentAt
    resolvedBy
    resolutionNote
    events {
      at
      type
      message
      actorId
      data
    }
  }
  ${ADMIN_USER_FIELDS}
`;

export const ADMIN_PAYMENTS: TypedDocumentNode<
  { adminPayments: { data: AdminPayment[]; meta: PaginationMeta } },
  { page?: number; limit?: number; tab?: AdminPaymentTab; search?: string | null }
> = gql`
  query AdminPayments($page: Int, $limit: Int, $tab: String, $search: String) {
    adminPayments(page: $page, limit: $limit, tab: $tab, search: $search) {
      data {
        ...AdminPaymentFields
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
  ${ADMIN_PAYMENT_FIELDS}
`;

export const ADMIN_PAYMENT_COUNTS: TypedDocumentNode<
  { adminPaymentCounts: AdminPaymentCounts },
  { search?: string | null }
> = gql`
  query AdminPaymentCounts($search: String) {
    adminPaymentCounts(search: $search) {
      all
      open
      completed
      failed
      needsReview
      refunded
    }
  }
`;

export const ADMIN_BILLING_SUMMARY: TypedDocumentNode<
  { adminBillingSummary: AdminBillingSummary },
  { days?: number }
> = gql`
  query AdminBillingSummary($days: Int) {
    adminBillingSummary(days: $days) {
      days
      paymentsEnabled
      environment
      revenueKes
      revenueTodayKes
      started
      completed
      failed
      needsReview
      unmatchedCallbacks
      daily {
        date
        revenueKes
        completed
      }
      byItem {
        code
        count
        revenueKes
      }
    }
  }
`;

export const ADMIN_MPESA_CALLBACKS: TypedDocumentNode<
  { adminMpesaCallbacks: { data: AdminMpesaCallback[]; meta: PaginationMeta } },
  { page?: number; limit?: number; status?: MpesaCallbackStatus | null }
> = gql`
  query AdminMpesaCallbacks($page: Int, $limit: Int, $status: MpesaCallbackStatus) {
    adminMpesaCallbacks(page: $page, limit: $limit, status: $status) {
      data {
        id
        checkoutRequestId
        merchantRequestId
        resultCode
        resultDesc
        amount
        receipt
        phone
        transactionDate
        status
        paymentId
        attempts
        lastError
        resolutionNote
        createdAt
      }
      meta {
        page
        limit
        total
        totalPages
        hasNextPage
        hasPrevPage
      }
    }
  }
`;

export const ADMIN_RECHECK_PAYMENT: TypedDocumentNode<{ adminRecheckPayment: AdminPayment }, { id: string }> = gql`
  mutation AdminRecheckPayment($id: String!) {
    adminRecheckPayment(id: $id) {
      ...AdminPaymentFields
    }
  }
  ${ADMIN_PAYMENT_FIELDS}
`;

export const ADMIN_COMPLETE_PAYMENT: TypedDocumentNode<
  { adminCompletePayment: AdminPayment },
  { id: string; note: string; receipt?: string | null }
> = gql`
  mutation AdminCompletePayment($id: String!, $note: String!, $receipt: String) {
    adminCompletePayment(id: $id, note: $note, receipt: $receipt) {
      ...AdminPaymentFields
    }
  }
  ${ADMIN_PAYMENT_FIELDS}
`;

export const ADMIN_MARK_PAYMENT_REFUNDED: TypedDocumentNode<
  { adminMarkPaymentRefunded: AdminPayment },
  { id: string; note: string }
> = gql`
  mutation AdminMarkPaymentRefunded($id: String!, $note: String!) {
    adminMarkPaymentRefunded(id: $id, note: $note) {
      ...AdminPaymentFields
    }
  }
  ${ADMIN_PAYMENT_FIELDS}
`;

export const ADMIN_MARK_PAYMENT_FAILED: TypedDocumentNode<
  { adminMarkPaymentFailed: AdminPayment },
  { id: string; note: string }
> = gql`
  mutation AdminMarkPaymentFailed($id: String!, $note: String!) {
    adminMarkPaymentFailed(id: $id, note: $note) {
      ...AdminPaymentFields
    }
  }
  ${ADMIN_PAYMENT_FIELDS}
`;

export const ADMIN_RESOLVE_MPESA_CALLBACK: TypedDocumentNode<
  { adminResolveMpesaCallback: AdminMpesaCallback },
  { id: string; note: string }
> = gql`
  mutation AdminResolveMpesaCallback($id: String!, $note: String!) {
    adminResolveMpesaCallback(id: $id, note: $note) {
      id
      status
      resolutionNote
    }
  }
`;
