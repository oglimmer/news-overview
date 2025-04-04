import type { FeedEntry, NewsEntry } from "@/interfaces";
import { login, vote, fetchFeeds, fetchNews, fetchTagGroup } from "@/services/remote";
import { defineStore } from "pinia"


export const useDataStore = defineStore('data', {
  state: () => ({
    loggedIn: false,
    email: '',
    authToken: '',
    feedEntries: [] as FeedEntry[],
    selectedFeeds: [] as number[],
    newsEntries: [] as NewsEntry[],
    selectedTagGroups: [] as string[],
    excludedTagGroups: [] as string[],
    tagGroupKeys: [] as string[],
    dateToShow: [new Date().getFullYear(), new Date().getMonth(), new Date().getDate()] as number[],
    excludeAds: false,
    tagGroupData: {} as Record<string, string[]>
  }),
  getters: {
    authentizationHeader(state) {
      return state.loggedIn ? `Basic ${btoa(state.email+':'+state.authToken)}` : `Basic ${btoa(__API_USER__+':'+__API_USER__)}`;
    },
    filteredNews(state) {
      let filtered = state.newsEntries.filter(
        (entry) => !(state.excludeAds && entry.advertising)
      )

      // Client-side feed filtering
      if (state.selectedFeeds.length > 0) {
        filtered = filtered.filter(entry => state.selectedFeeds.includes(entry.feedId))
      }

      if (state.selectedTagGroups.length > 0) {
        const allowedTags = new Set<string>()
        state.selectedTagGroups.forEach(group => {
          ;(state.tagGroupData[group] || []).forEach(tag => allowedTags.add(tag))
        })
        filtered = filtered.filter(entry => entry.tags.some(tag => allowedTags.has(tag)))
      }

      if (state.excludedTagGroups.length > 0) {
        const excludedTags = new Set<string>()
        state.excludedTagGroups.forEach(group => {
          ;(state.tagGroupData[group] || []).forEach(tag => excludedTags.add(tag))
        })
        filtered = filtered.filter(entry => !entry.tags.some(tag => excludedTags.has(tag)))
      }

      return filtered
    },
    morningNews(): NewsEntry[] {
      return this.filteredNews.filter((entry: NewsEntry) => {
        const hour = new Date(entry.createdOn).getHours()
        return hour >= 0 && hour < 12
      })
    },
    afternoonNews(): NewsEntry[] {
      return this.filteredNews.filter((entry: NewsEntry) => {
        const hour = new Date(entry.createdOn).getHours()
        return hour >= 12 && hour < 18
      })
    },
    nightNews(): NewsEntry[] {
      return this.filteredNews.filter((entry: NewsEntry) => {
        const hour = new Date(entry.createdOn).getHours()
        return hour >= 18 && hour < 24
      })
    },
    // --- Computed property for tag group counts ---
    tagGroupCounts: (state) => {
      const counts: Record<string, number> = {}
      const filteredNewsEntries = state.selectedFeeds.length > 0
        ? state.newsEntries.filter(entry => state.selectedFeeds.includes(entry.feedId))
        : state.newsEntries

      for (const key of state.tagGroupKeys) {
        const tags = state.tagGroupData[key] || []
        counts[key] = filteredNewsEntries.filter((entry) =>
          entry.tags.some((tag) => tags.includes(tag))
        ).length
      }
      return counts
    },
    isDateToday: (state) => {
      const today = new Date();
      const dts = new Date(state.dateToShow[0], state.dateToShow[1], state.dateToShow[2]);
      return dts.getDate() === today.getDate() &&
        dts.getMonth() === today.getMonth() &&
        dts.getFullYear() === today.getFullYear();
    },
    dateToShowAsDate: (state) => {
      return new Date(state.dateToShow[0], state.dateToShow[1], state.dateToShow[2]);
    }
  },
  actions: {
    async authorize(_email: string, _password: string) {
      const _authToken = await login(_email, _password);
      if (_authToken) {
        this.loggedIn = true;
        this.email = _email;
        this.authToken = _authToken;
        this.fetchNews();
        return '';
      }
      return "Login Failed";
    },
    async fetchFeeds() {
      const response = await fetchFeeds();
      if (response) {
        this.feedEntries = response;
      }
    },
    async fetchNews() {
      const date = this.dateToShowAsDate;
      const response = await fetchNews(date, []);
      if (response) {
        this.newsEntries = response;
      }
    },
    async fetchTagGroup() {
      const date = this.dateToShowAsDate;
      const response = await fetchTagGroup(date);
      if (response) {
        this.tagGroupData = response;
        this.tagGroupKeys = Object.keys(this.tagGroupData)
      }
    },
    async addVote(newsId: number, up: boolean) {
      await vote(newsId, up);
      this.newsEntries = this.newsEntries.map((entry) => {
        if (entry.id === newsId) {
          entry.voted = up;
        }
        return entry;
      });
    },
    async changeDate(days: number) {
      if (days === 0) {
        this.dateToShow = [new Date().getFullYear(), new Date().getMonth(), new Date().getDate()];
      } else {
        const d = new Date(this.dateToShow[0], this.dateToShow[1], this.dateToShow[2]);
        d.setDate(d.getDate() + days);
        this.dateToShow = [d.getFullYear(), d.getMonth(), d.getDate()];
      }
      await this.fetchNews();
      await this.fetchTagGroup();
    },
  },
  persist: true
})
