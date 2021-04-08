<template>
    <div id="ide" @dragover.prevent @drop.capture.stop.prevent="dropped">
        <div v-for="panel in panels" :key="panel.id"
                class="panel"
                :class="['panel__' + (panel._component || panel.id)]">
            <component 
                :is="panel._component || panel.id"
                :ref="panel.id" />
        </div>
        <messages :messages="messages"/>
    </div>
</template>
<script>
import Messages from './components/messages.vue';

export default {
    props: ["panels", "messages"],
    methods: {
        dropped(event) {
            for (let fl of event.dataTransfer.files) {
                this.$emit('file-open', fl);
                return;
            }
        }
    },
    components: {Messages}
}
</script>