<script lang="ts">
	import NavBar from '$lib/ios/NavBar.svelte';
	import ProfileForm from '$lib/components/ProfileForm.svelte';
</script>

<svelte:head><title>Mon profil · Biotope</title></svelte:head>

<NavBar title="Mon profil" back={{ href: '/reglages', label: 'Plus' }} large={false} />

<p class="subhead mb-5 mt-2 px-1 text-label2">
  Biotope s’adapte à toi : la formule d’accueil, les conseils du jour, les jalons de ton parcours et la couleur de l’appli.
</p>

<ProfileForm />
