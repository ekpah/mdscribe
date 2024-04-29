<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { getContext } from 'svelte';
	const inputData = getContext('inputData');
	let gender = 'undefined';
	$: inputData.set({ ...$inputData, gender });
</script>

<RadioGroup.Root bind:value={gender}>
	<div class="flex items-center space-x-2">
		<RadioGroup.Item value="male" id="male" />
		<Label for="option-one">Männlich</Label>
	</div>
	<div class="flex items-center space-x-2">
		<RadioGroup.Item value="female" id="female" />
		<Label for="option-two">Weiblich</Label>
	</div>
</RadioGroup.Root>
