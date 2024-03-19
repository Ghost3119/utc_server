import { world, EquipmentSlot, ItemStack, system, MolangVariableMap } from "@minecraft/server"
const equipmentSlots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]

system.beforeEvents.watchdogTerminate.subscribe(s => { s.cancel = true })

const worldTick = () => system.run(() => {
    if (system.currentTick % 5 === 0) {
        for (const player of world.getAllPlayers()) {
            const inventory = player.getComponent('inventory').container
            const item = inventory.getItem(player.selectedSlot)

            try {
                if (item.typeId === 'effect99:key' && item.getLore()[0]) {
                    let { x, y, z } = player.location
                    x -= 0.5; y -= 0.5; z -= 0.5
                    const coords = item.getLore()[0].match(/-?\d+/g)
                    if (coords && coords.length === 4) {
                        const dx = parseInt(coords[1])
                        const dy = parseInt(coords[2])
                        const dz = parseInt(coords[3])

                        const distance = Math.sqrt((x - dx) ** 2 + (y - dy) ** 2 + (z - dz) ** 2)
                        const dLore = item.getLore()[1]
                        if (dLore.slice(4) === player.dimension.id) {
                            player.onScreenDisplay.setActionBar(`§pPlace of death: §c${dx}, ${dy}, ${dz} \n§7Block distance: §f${(distance - 0.25).toFixed(2)}`)
                        } else player.onScreenDisplay.setActionBar(`§pGo to the dimension: §7${dLore.split(":")[1].slice(0, 1).toUpperCase() + dLore.split(":")[1].slice(1).replace(/_/g, " ")}`)

                        if (distance <= 6 && player.dimension.getBlock({ x: dx, y: dy, z: dz }).typeId != 'effect99:grave' && dLore.slice(4) === player.dimension.id) {
                            inventory.setItem(player.selectedSlot, undefined)
                            world.playSound('random.break', { x, y, z }, { volume: 0.5 })
                        }
                    }
                }
            } catch (e) { }
        }
    }
    worldTick()
})
worldTick()

world.afterEvents.itemStartUseOn.subscribe(i => {
    try {
        const block = i.block
        if (block.typeId === 'effect99:grave') {
            breakGrave(i.source, block)
        }
    } catch (e) { }
})

world.afterEvents.entityHitBlock.subscribe(e => {
    try {
        const block = e.hitBlock
        if (block.typeId === 'effect99:grave') {
            breakGrave(e.damagingEntity, block)
        }
    } catch (e) { }
})

function breakGrave(player, block) {
    const inventory = player.getComponent('inventory').container
    const item = inventory.getItem(player.selectedSlot)

    if (item && item.typeId === 'effect99:key') {
        const { x, y, z } = block.location
        const dimension = player.dimension

        let coords = []
        try { coords = item.getLore()[0].match(/-?\d+/g) } catch (e) { }

        if (coords.length === 4) {
            const dx = parseInt(coords[1])
            const dy = parseInt(coords[2])
            const dz = parseInt(coords[3])
            let isEmpty = true

            for (const entity of dimension.getEntitiesAtBlockLocation({ x, y, z })) {
                if (entity.typeId === 'entity:grave_inventory') {
                    if (entity.nameTag.split("\n")[0].slice(2).trim() === player.nameTag) {
                        if (dx === x && dy === y && dz === z && item.getLore()[1].slice(4) === dimension.id) {
                            dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`)

                            world.playSound('random.break', { x, y, z }, { volume: 0.5 })
                            world.playSound('block.end_portal.spawn', { x, y, z }, { pitch: 1.5 })

                            for (let i = 0; i < 12; i++) {
                                dimension.spawnParticle('effect99:souls', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, new MolangVariableMap())
                            }
                            inventory.setItem(player.selectedSlot, undefined)
                        }
                        else player.sendMessage('§cYou have the wrong key!')
                    } else player.sendMessage('§pYou are not the owner of the gravestone.')
                    isEmpty = false
                }
            }
            if (isEmpty && dx === x && dy === y && dz === z && item.getLore()[1].slice(4) === dimension.id) {
                world.playSound('random.break', { x, y, z }, { volume: 0.5 })
                inventory.setItem(player.selectedSlot, undefined)
            }
        } else for (const entity of dimension.getEntitiesAtBlockLocation({ x, y, z })) {
            if (entity.typeId === 'entity:grave_inventory') {
                if (entity.nameTag.split("\n")[0].slice(2).trim() === player.nameTag) {
                    world.playSound('random.pop', { x, y, z })
                    item.setLore([`§r§9Place of death: §c${x}, ${y}, ${z}`, `§r§8${dimension.id}`])
                    inventory.setItem(player.selectedSlot, item)
                } 
                else player.onScreenDisplay.setActionBar('§pYou are not the owner of the gravestone.')
                break
            }
        }
    } else player.onScreenDisplay.setActionBar('You need a key')
}

world.afterEvents.entityDie.subscribe(e => {
    const entity = e.deadEntity

    if (entity.typeId === 'minecraft:player') {
        let { x, y, z } = entity.location
        x = Math.floor(x) + 0.5; y = Math.floor(y); z = Math.floor(z) + 0.5
        if (entity.dimension.id === 'minecraft:the_end' && y <= 0) {
            y = 1
            entity.dimension.fillBlocks({ x: x + 1, y: 0, z: z + 1 }, { x: x - 1, y: 0, z: z - 1 }, 'minecraft:end_stone')
        }
        let setLocation = { x, y, z }
        if (entity.dimension.getBlock({ x, y, z }).typeId === 'effect99:grave') {
            function newLocation({ x, y, z }) {
                const locations = [{ x: x + 1, y, z }, { x: x - 1, y, z }, { x, y, z: z + 1 }, { x, y, z: z - 1 }, { x: x + 1, y, z: z + 1 }, { x: x - 1, y, z: z - 1 }, { x: x - 1, y, z: z + 1 }, { x: x + 1, y, z: z - 1 }]
                const graveFounds = []
                let notFound = true

                for (const { x, y, z } of locations) {
                    if (entity.dimension.getBlock({ x, y, z }).typeId != 'effect99:grave') {
                        setLocation = { x, y, z }
                        notFound = false
                        break
                    }
                    else { graveFounds.push({ x, y, z }) }
                }
                if (notFound) {
                    newLocation(graveFounds[Math.floor(Math.random() * graveFounds.length)])
                }
            }
            newLocation({ x, y, z })
        }
        x = setLocation.x; y = setLocation.y; z = setLocation.z;
        entity.dimension.fillBlocks({ x, y, z }, { x, y, z }, 'effect99:grave')
        const block = entity.dimension.getBlock({ x, y, z })
        const inventory = entity.getComponent("inventory").container
        const graveEntity = entity.dimension.spawnEntity('entity:grave_inventory', { x, y, z })
        const graveInventory = graveEntity.getComponent("inventory").container
        graveEntity.nameTag = `§c${entity.nameTag} \n R.I.P`

        let isEmpty = true

        for (let i = 0; i < 36; i++) {
            const item = inventory.getItem(i)
            graveInventory.setItem(i, item)
            if (item) isEmpty = false
        }
        const equipment = entity.getComponent('equippable')
        let i = 37
        for (const slot of equipmentSlots) {
            const item = equipment.getEquipmentSlot(slot).getItem()
            graveInventory.setItem(i, item)
            equipment.setEquipment(slot, undefined)
            if (item) isEmpty = false
            i++
        }
        inventory.clearAll()
        if (isEmpty) graveEntity.remove()
        const permutation = block.permutation
        block.setPermutation(permutation.withState("block:rotation", Math.floor(Math.random() * 4 + 1)).withState("block:destructible", isEmpty ? 0 : 1))

        const key = new ItemStack('effect99:key')
        key.setLore([`§r§9Place of death: §c${x - 0.5}, ${y}, ${z - 0.5}`, `§r§8${entity.dimension.id}`])
        inventory.addItem(key)
    }
})

world.beforeEvents.pistonActivate.subscribe(p => {
    for (const { x, y, z } of p.piston.getAttachedBlocks()) {
        if (p.dimension.getBlock({ x, y, z }).typeId === "effect99:grave") {
            p.cancel = true
        }
    }
})

world.afterEvents.worldInitialize.subscribe(() => {
    world.getDimension('overworld').runCommand('gamerule keepinventory true')
})