// Serves dist/ as static assets, plus two redirects:
//   skilledtradesmichigan.com (and www)  ->  https://skilledtrades-usa.com/michigan  (301)
//   www.skilledtrades-usa.com            ->  https://skilledtrades-usa.com            (301)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === 'skilledtradesmichigan.com' || host === 'www.skilledtradesmichigan.com') {
      return Response.redirect('https://skilledtrades-usa.com/michigan', 301);
    }
    if (host === 'www.skilledtrades-usa.com') {
      url.hostname = 'skilledtrades-usa.com';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
