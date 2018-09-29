import { Pt, Group, Circle, Rectangle, Util, World, Particle, UIButton, UI } from 'pts';
import PtsCanvas from "./PtsCanvas.jsx";
import Converter from "./Converter.js"
import data from "./mockIPLDData.js"
import React, { Component } from 'react'

export default class IPLDRender extends PtsCanvas {

    constructor(props) {
        super(props);
        this.nodeRadius = 50
        this.nodeArm = 50
        this.world = null

        this.nodes = {}
        this.btns = []

        this.selectedCID = null
        this.selectedRelationship = undefined

        this.selectedNodeHistory = []
        this._nodes = Converter.dagsToRender(data)

        document.onkeydown = this.checkKey.bind(this);

        this.setIpfs()
    }

    setIpfs() {
        if (!this.props.ipfs) throw (new Error('No IPFS object'))
        let that = this
        this.props.ipfs.on('start', () => {
            that.onIpfsReady(that.props.ipfs)
        })

        if (this.props.ipfs.isOnline())
            this.onIpfsReady()
    }

    onIpfsReady(ipfs) {
        for (let cid of this.props.cids)
            this.loadOriginCid(cid)
    }

    loadOriginCid(cid) {
        ipfs.dag.get(cid, (error, result) => {
            if (error) {
                throw (error)
            }

            let node = Converter.dagToRender(result.value)
            this.nodes[cid] = {}
            this.nodes[cid] = node
            console.log('nodes', this.nodes)
        })
    }

    create() {
        this.world = new World(this.space.innerBound, 1, new Pt(0, 0));
        let i = 0
        let group = []
        for (let cid in this._nodes) {
            if (!this._nodes.hasOwnProperty(cid))
                continue

            let n = this._nodes[cid]
            this.setNodePt(n, i)
            group.push(n.pt)
            if (i === 0)
                this.selectNewNode(n.cid)
            i++

            this.addInteraction(n)
        }
        this.allPts = new Group(group)
    }

    addInteraction(n) {
        n.btn = UIButton.fromCircle(Circle.fromCenter(n.pt, this.getNodeRadius()))
        n.btn.onClick((a) => {
            this.selectNewNode(n.cid)
        })

        //n.btn.onHover(console.log, console.log)
        this.btns.push(n.btn)
    }

    updateBtn(n) {
        n.btn.group[0].to(n.pt)
    }

    componentDidUpdate(prevProps) {
        this.checkPause()
    }

    checkPause() {
        if (this.props.pause) {
            this.space.pause();

        } else {
            this.space.resume();
        }
    }

    start(space, bound) {
        this.create();
    }

    resize() {
        //this.create();
    }

    setNodePt(n, i) {
        if (!n.pt) {
            let random = new Pt([Util.randomInt(100), Util.randomInt(100)])
            let initPt = this.space.center.$add(random)
            //Todo: Never updated
            n.pt = new Particle(initPt).size(this.getNodeRadius() + this.getNodeArm());
            this.world.add(n.pt)
        }
    }

    addForces(nodes, n) {
        if (n.relationships) {
            for (let r of n.relationships) {

                let destPt = nodes[r.destinationNode].pt
                //the attraction force will be proporcional to its distance
                let distance = n.pt.$subtract(destPt)
                let forceAmount = 2
                //negative so it attracts
                let force = distance.$multiply(-1 * forceAmount)
                n.pt.addForce(force)
                //oposite force is added to the destination pt
                destPt.addForce(force.multiply(-1))
            }
        }
    }

    drawRelationships(nodes, n) {
        let lineColor = "#999"
        if (n.relationships) {
            for (let r of n.relationships) {
                let destPt = nodes[r.destinationNode].pt
                let line = new Group(n.pt, destPt)
                this.form.strokeOnly(lineColor, 1)
                this.form.line(line)

                let arrow = this.getArrow(n.pt, destPt, -this.getNodeRadius())
                this.form.fillOnly('#f36', 1)
                this.form.polygon(arrow)
            }
        }
    }

    getArrow(originPt, destPt, offset = 1, length = 10, sharpness = 0.3) {
        let pointer = destPt.$subtract(originPt)
        let offsetPt = destPt
        if (pointer.magnitude()) {
            pointer.unit()
            offsetPt = pointer.$unit().multiply(offset).add(destPt)
        }
        pointer.multiply(length)
        let sideVertex1 = new Pt(pointer.y, -pointer.x).multiply(sharpness)
        let sideVertex2 = new Pt(-pointer.y, pointer.x).multiply(sharpness)
        let arrow = new Group(pointer, sideVertex1, sideVertex2)
        arrow.moveTo(offsetPt)
        return arrow
    }

    getNodeRadius() {
        return (this.nodeRadius * this.props.zoom)
    }

    getNodeArm() {
        return (this.nodeArm * this.props.zoom)
    }

    drawText(n) {
        //font style
        this.form.font(12).alignText("center");
        this.form.fill("#333")
        //text box
        let tb = Rectangle.fromCenter(n.pt, this.getNodeRadius() * 2)
        this.form.textBox(tb, n.cid, "middle", "…")
    }

    drawBubble(n) {
        this.form.fillOnly("#eee")
        this.form.point(n.pt, this.getNodeRadius(), 'circle')
    }

    drawHighlightBubble(pt, color = "#f36") {
        this.form.strokeOnly(color)
        this.form.point(pt, this.getNodeRadius(), 'circle')
    }

    drawHighlightLine(pt1, pt2, color = "#f36") {
        this.form.strokeOnly(color)
        this.form.line([pt1, pt2])
    }

    highlight(n) {
        if (!n)
            return

        this.drawHighlightBubble(n.pt)
        if (!this.selectedRelationship)
            return

        for (let r of n.relationships) {
            if (r.destinationNode === this.selectedRelationship) {
                let destNode = this._nodes[r.destinationNode]
                this.drawHighlightLine(n.pt, destNode.pt)
                this.drawHighlightBubble(destNode.pt)
            }
        }
    }

    animate(time, ftime) {
        for (let cid in this._nodes) {
            if (!this._nodes.hasOwnProperty(cid))
                continue

            let n = this._nodes[cid]
            this.updateBtn(n)
            this.addForces(this._nodes, n)
            this.drawRelationships(this._nodes, n)
            this.drawBubble(n)
            this.drawText(n)
            this.world.update(ftime)
        }
        this.highlight(this._nodes[this.selectedCID])
    }

    action(type, px, py) {
        UI.track(this.btns, type, new Pt(px, py));
    }

    selectNewNode(newCID) {
        if (!this._nodes[newCID])
            return

        if (this.selectedNodeHistory[this.selectedNodeHistory.length - 1] !== newCID) {
            this.selectedNodeHistory.push(newCID)
        }
        this.selectedCID = newCID
        this.selectedRelationship = null
    }

    selectPreviousNode() {
        if (this.selectedRelationship) {
            this.selectedRelationship = null
            return
        }
        if (this.selectedNodeHistory.length <= 1)
            return
        this.selectedNodeHistory.pop()
        this.selectedCID = this.selectedNodeHistory[this.selectedNodeHistory.length - 1]
    }

    selectNextRelationship(jumps) {
        let currentN = this._nodes[this.selectedCID]
        if (!currentN)
            return
        let currentIndex = this.getRelationshipIndex(currentN, this.selectedRelationship)
        if (currentIndex === undefined) {
            if (currentN.relationships)
                this.selectedRelationship = currentN.relationships[0].destinationNode
            return
        }

        let nextIndex = (currentIndex + jumps) % currentN.relationships.length
        if (nextIndex < 0)
            nextIndex = currentN.relationships.length + nextIndex
        let relationship = currentN.relationships[nextIndex]
        if (relationship)
            this.selectedRelationship = relationship.destinationNode
    }

    getRelationshipIndex(n, relationshipCid) {
        if (!n.relationships)
            return
        return n.relationships.findIndex((r) => {
            return r.destinationNode === relationshipCid
        })
    }

    checkKey(e) {

        e = e || window.event;

        if (e.keyCode === '38') {//up arrow
            this.selectNewNode(this.selectedRelationship)
        }
        else if (e.keyCode === '40') {// down arrow
            this.selectPreviousNode()
        }
        else if (e.keyCode === '37') {// left arrow
            this.selectNextRelationship(-1)

        }
        else if (e.keyCode === '39') {// right arrow
            this.selectNextRelationship(1)
        }

    }

}
